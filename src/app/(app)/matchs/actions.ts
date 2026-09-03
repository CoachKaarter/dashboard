"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, canAccessTeam, canManageCategory } from "@/lib/authz";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import {
  isValidFormation,
  isValidSlotIndex,
  scoreSchema,
  statRowSchema,
  neededSchema,
  competitionSchema,
  bilanSchema,
  tournamentSchema,
  plateauResultSchema,
  SURFACE_TYPES,
} from "@/lib/match-validation";
import { readXlsxFirstSheetGrid, extractMatchRows, buildMatchImportCandidates } from "@/lib/match-import";
import { TRANSPORT_MODES } from "@/lib/equipment";
import { resolveMeetTime, resolveEstimatedEnd, resolveEstimatedReturn, resolveField, selectMatchTemplate } from "@/lib/match-parent-info";
import { getWeekStart, isWeekendMatchDate } from "@/lib/availability";

function computeMeetTime(time: string | null, delaiRdv: number): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m - delaiRdv;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/**
 * Résout les infos parents d'un match à partir de ce qui a été saisi sur le
 * formulaire (override), du modèle de match retenu et des habitudes de
 * l'équipe (voir src/lib/match-parent-info.ts pour la hiérarchie complète).
 * Les valeurs résolues sont matérialisées directement dans les colonnes
 * Match existantes au moment de l'enregistrement — un changement ultérieur
 * des habitudes de l'équipe ou du modèle ne modifie donc jamais
 * rétroactivement un match déjà enregistré (§15 : pas de second champ
 * "snapshot", la matérialisation à l'écriture suffit).
 */
function resolveParentInfoFields(input: {
  kickoffTime: string | null;
  meetTimeOverride: string | null;
  estimatedEndOverride: string | null;
  estimatedReturnOverride: string | null;
  transportModeOverride: string | null;
  dressCodeOverride: string | null;
  personalGearOverride: string | null;
  mealInfoOverride: string | null;
  parentInstructionsOverride: string | null;
  template: {
    meetTimeDeltaMinutes: number | null;
    durationMinutes: number | null;
    returnDelayMinutes: number | null;
    transportMode: string | null;
    dressCode: string | null;
    personalGear: string | null;
    mealInfo: string | null;
    parentInstructions: string | null;
  } | null;
  team: {
    meetTimeDeltaMinutes: number | null;
    defaultDurationMinutes: number | null;
    defaultReturnDelayMinutes: number | null;
    defaultTransportMode: string | null;
    defaultDressCode: string | null;
    defaultPersonalGear: string | null;
    defaultMealInfo: string | null;
    defaultParentInstructions: string | null;
  };
  globalDelaiRdv: number;
}) {
  const meetTime = resolveMeetTime({
    kickoffTime: input.kickoffTime,
    override: input.meetTimeOverride,
    templateDeltaMinutes: input.template?.meetTimeDeltaMinutes ?? null,
    teamDeltaMinutes: input.team.meetTimeDeltaMinutes,
    globalDeltaMinutes: input.globalDelaiRdv,
  }).value;
  const estimatedEndTime = resolveEstimatedEnd({
    kickoffTime: input.kickoffTime,
    override: input.estimatedEndOverride,
    templateDurationMinutes: input.template?.durationMinutes ?? null,
    teamDurationMinutes: input.team.defaultDurationMinutes,
  }).value;
  const estimatedReturnTime = resolveEstimatedReturn({
    estimatedEnd: estimatedEndTime,
    override: input.estimatedReturnOverride,
    templateReturnDelayMinutes: input.template?.returnDelayMinutes ?? null,
    teamReturnDelayMinutes: input.team.defaultReturnDelayMinutes,
  }).value;
  const transportMode = resolveField(input.transportModeOverride, input.template?.transportMode, input.team.defaultTransportMode).value;
  const dressCode = resolveField(input.dressCodeOverride, input.template?.dressCode, input.team.defaultDressCode).value;
  const personalGear = resolveField(input.personalGearOverride, input.template?.personalGear, input.team.defaultPersonalGear).value;
  const mealInfo = resolveField(input.mealInfoOverride, input.template?.mealInfo, input.team.defaultMealInfo).value;
  const parentInstructions = resolveField(
    input.parentInstructionsOverride,
    input.template?.parentInstructions,
    input.team.defaultParentInstructions
  ).value;
  return { meetTime, estimatedEndTime, estimatedReturnTime, transportMode, dressCode, personalGear, mealInfo, parentInstructions };
}

async function assertMatchAccess(matchId: string) {
  const user = await requireUser();
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    select: {
      teamId: true,
      date: true,
      formation: true,
      competition: true,
      team: {
        select: {
          format: true,
          category: true,
          meetTimeDeltaMinutes: true,
          defaultTransportMode: true,
          defaultDressCode: true,
          defaultPersonalGear: true,
          defaultMealInfo: true,
          defaultParentInstructions: true,
          defaultDurationMinutes: true,
          defaultReturnDelayMinutes: true,
        },
      },
    },
  });
  if (!canAccessTeam(user, match.teamId)) throw new Error("Accès refusé.");
  return { user, match };
}

// A player can't physically be at two matches at once. Same-team matches on
// the same day are fine (tournament pool games all use that team's squad),
// so the conflict only fires against a convocation on a DIFFERENT team's
// match that day — the case this app's own player fluidity (V5.2 Phase 0)
// makes newly possible: a floating player picked into two teams' matches
// on the same Saturday.
async function assertNoSameDayConflict(matchId: string, teamId: string, date: Date, playerId: string) {
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const conflict = await prisma.matchConvocation.findFirst({
    where: {
      playerId,
      matchId: { not: matchId },
      match: { date: { gte: dayStart, lt: dayEnd }, teamId: { not: teamId } },
    },
    include: { match: { include: { team: true } } },
  });
  if (conflict) {
    throw new Error(`Ce joueur est déjà convoqué le même jour avec ${conflict.match.team.code}.`);
  }
}

// Scoped by CATEGORY (U12/U13), not by the player's own administrative
// team — the week-end répartition (WeekendAssignment) routinely moves a
// player to a different team within their category (e.g. a U13A player
// covering for U13B on a given Saturday), and once convoked there they
// must work normally in that match's fiche (V5.2 §2). What this still
// blocks is the real hole: a player from an unrelated category (or an
// unrelated club roster) being convoked/placed/rated on a match they have
// no business being in.
async function assertPlayerOnMatchTeam(category: string, playerId: string) {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId }, select: { team: { select: { category: true } } } });
  if (player.team.category !== category) throw new Error("Ce joueur ne fait pas partie de la catégorie de ce match.");
}

// Sur un match du samedi (la seule date que /week-end suit — voir
// isWeekendMatchDate), une convocation ajoutée/retirée directement depuis la
// fiche match tient la répartition du week-end (WeekendAssignment) à jour
// dans l'autre sens : le sens week-end → match existait déjà via "Générer
// les convocations" (convocationsToCreate) ; celui-ci comble match → week-end.
// Écrase sans hésiter une affectation existante d'un AUTRE joueur — non, d'un
// autre MATCH/ÉQUIPE pour ce même joueur ce même samedi (WeekendAssignment
// n'autorise qu'une seule équipe par joueur et par week-end) : une
// convocation posée à la main sur la fiche match est un choix explicite et
// plus récent que ce qu'affichait /week-end. À la suppression, ne retire
// l'affectation que si elle pointait bien vers CE match — jamais celle
// d'une autre équipe.
async function syncWeekendAssignmentOnConvocation(
  match: { id: string; teamId: string; date: Date },
  playerId: string,
  userId: string,
  action: "add" | "remove"
) {
  if (!isWeekendMatchDate(match.date)) return;
  const weekendDate = match.date;
  if (action === "add") {
    await prisma.weekendAssignment.upsert({
      where: { weekendDate_playerId: { weekendDate, playerId } },
      update: { teamId: match.teamId, matchId: match.id, assignedById: userId },
      create: { weekStartDate: getWeekStart(weekendDate), weekendDate, playerId, teamId: match.teamId, matchId: match.id, assignedById: userId },
    });
  } else {
    const existing = await prisma.weekendAssignment.findUnique({ where: { weekendDate_playerId: { weekendDate, playerId } } });
    if (existing && existing.matchId === match.id) {
      await prisma.weekendAssignment.delete({ where: { id: existing.id } });
    }
  }
}

export async function toggleConvocation(matchId: string, playerId: string) {
  const { user, match } = await assertMatchAccess(matchId);
  await assertPlayerOnMatchTeam(match.team.category, playerId);
  const existing = await prisma.matchConvocation.findUnique({
    where: { matchId_playerId: { matchId, playerId } },
  });
  if (existing) {
    await prisma.matchConvocation.delete({ where: { id: existing.id } });
    // also drop any composition slot for that player on this match
    await prisma.compositionSlot.deleteMany({ where: { matchId, playerId } });
    await syncWeekendAssignmentOnConvocation({ id: matchId, teamId: match.teamId, date: match.date }, playerId, user.id, "remove");
  } else {
    await assertNoSameDayConflict(matchId, match.teamId, match.date, playerId);
    await prisma.matchConvocation.create({ data: { matchId, playerId } });
    await syncWeekendAssignmentOnConvocation({ id: matchId, teamId: match.teamId, date: match.date }, playerId, user.id, "add");
  }
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath(`/coach/matchs/${matchId}`);
  revalidatePath("/matchs");
  revalidatePath("/");
  revalidatePath("/week-end");
}

export async function assignSlot(matchId: string, slotIndex: number, playerId: string) {
  const { match } = await assertMatchAccess(matchId);
  await assertPlayerOnMatchTeam(match.team.category, playerId);
  if (!isValidSlotIndex(match.formation, slotIndex)) throw new Error("Position invalide pour cette formation.");
  const convoked = await prisma.matchConvocation.findUnique({ where: { matchId_playerId: { matchId, playerId } } });
  if (!convoked) throw new Error("Le joueur doit être convoqué avant d'être placé dans la composition.");
  await prisma.compositionSlot.deleteMany({ where: { matchId, playerId } });
  await prisma.compositionSlot.deleteMany({ where: { matchId, slotIndex } });
  await prisma.compositionSlot.create({ data: { matchId, slotIndex, playerId } });
  revalidatePath(`/matchs/${matchId}`);
}

export async function clearSlot(matchId: string, slotIndex: number) {
  await assertMatchAccess(matchId);
  await prisma.compositionSlot.deleteMany({ where: { matchId, slotIndex } });
  revalidatePath(`/matchs/${matchId}`);
}

export async function setFormation(matchId: string, formation: string) {
  const { match } = await assertMatchAccess(matchId);
  if (!isValidFormation(match.team.format, formation)) return;
  await prisma.match.update({ where: { id: matchId }, data: { formation } });
  await prisma.compositionSlot.deleteMany({ where: { matchId } });
  revalidatePath(`/matchs/${matchId}`);
}

export async function recordScore(matchId: string, formData: FormData) {
  await assertMatchAccess(matchId);
  const parsed = scoreSchema.safeParse({
    scoreFor: Number(formData.get("scoreFor")),
    scoreAgainst: Number(formData.get("scoreAgainst")),
  });
  if (!parsed.success) return;
  await prisma.match.update({
    where: { id: matchId },
    data: { status: "Joué", scoreFor: parsed.data.scoreFor, scoreAgainst: parsed.data.scoreAgainst },
  });
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath(`/coach/matchs/${matchId}`);
  revalidatePath("/matchs");
  revalidatePath("/");
}

// Un plateau (competition === "Plateau") n'a pas un adversaire/score
// unique comme un match classique — chaque rencontre vit dans
// PlateauResult, jamais dans Match.opponent/scoreFor/scoreAgainst qui
// restent inutilisés pour ce type de match.
function assertPlateauCompetition(competition: string) {
  if (competition !== "Plateau") throw new Error("Cette action n'est disponible que pour un match de type Plateau.");
}

export async function addPlateauResult(matchId: string, formData: FormData) {
  const { match } = await assertMatchAccess(matchId);
  assertPlateauCompetition(match.competition);
  const scoreForRaw = String(formData.get("scoreFor") || "").trim();
  const scoreAgainstRaw = String(formData.get("scoreAgainst") || "").trim();
  const parsed = plateauResultSchema.safeParse({
    opponent: String(formData.get("opponent") || ""),
    scoreFor: scoreForRaw ? Number(scoreForRaw) : null,
    scoreAgainst: scoreAgainstRaw ? Number(scoreAgainstRaw) : null,
  });
  if (!parsed.success) return;
  const count = await prisma.plateauResult.count({ where: { matchId } });
  await prisma.plateauResult.create({ data: { matchId, order: count, ...parsed.data } });
  revalidatePath(`/matchs/${matchId}`);
}

export async function updatePlateauResult(resultId: string, formData: FormData) {
  const result = await prisma.plateauResult.findUniqueOrThrow({ where: { id: resultId }, select: { matchId: true } });
  const { match } = await assertMatchAccess(result.matchId);
  assertPlateauCompetition(match.competition);
  const scoreForRaw = String(formData.get("scoreFor") || "").trim();
  const scoreAgainstRaw = String(formData.get("scoreAgainst") || "").trim();
  const parsed = plateauResultSchema.safeParse({
    opponent: String(formData.get("opponent") || ""),
    scoreFor: scoreForRaw ? Number(scoreForRaw) : null,
    scoreAgainst: scoreAgainstRaw ? Number(scoreAgainstRaw) : null,
  });
  if (!parsed.success) return;
  await prisma.plateauResult.update({ where: { id: resultId }, data: parsed.data });
  revalidatePath(`/matchs/${result.matchId}`);
}

export async function deletePlateauResult(resultId: string) {
  const result = await prisma.plateauResult.findUniqueOrThrow({ where: { id: resultId }, select: { matchId: true } });
  await assertMatchAccess(result.matchId);
  await prisma.plateauResult.delete({ where: { id: resultId } });
  revalidatePath(`/matchs/${result.matchId}`);
}

// Marque le plateau comme joué sans lui imposer un score unique — contexte
// distinct de recordScore(), réservé aux matchs classiques.
export async function markPlateauPlayed(matchId: string) {
  const { match } = await assertMatchAccess(matchId);
  assertPlateauCompetition(match.competition);
  await prisma.match.update({ where: { id: matchId }, data: { status: "Joué" } });
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath(`/coach/matchs/${matchId}`);
  revalidatePath("/matchs");
  revalidatePath("/");
}

export async function generateFeuille(matchId: string) {
  await assertMatchAccess(matchId);
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    include: { convocations: { include: { player: true } }, slots: true },
  });
  const placedIds = new Set(match.slots.map((s) => s.playerId));
  const bench = match.convocations.filter((c) => !placedIds.has(c.playerId));
  const positionByPlayerId = new Map(match.convocations.map((c) => [c.playerId, c.player.position]));

  const rows = [
    ...match.slots.sort((a, b) => a.slotIndex - b.slotIndex).map((s) => ({ playerId: s.playerId, role: "Titulaire" })),
    ...bench.map((c) => ({ playerId: c.playerId, role: "Remplaçant" })),
  ];

  // plannedRole is only ever set here, at creation, from the composition
  // as it stands right now — it is never touched again (see model
  // comment), so it stays "what was actually planned" even after role is
  // later edited to reflect what really happened on the day (§5).
  await prisma.$transaction(
    rows.map((r) =>
      prisma.matchPlayerStat.upsert({
        where: { matchId_playerId: { matchId, playerId: r.playerId } },
        update: {},
        create: {
          matchId,
          playerId: r.playerId,
          plannedRole: r.role,
          role: r.role,
          position: positionByPlayerId.get(r.playerId) ?? null,
          minutes: 0, // à confirmer par le coach — la composition ne détermine pas les minutes réelles
          goals: 0,
          assists: 0,
          note: null,
        },
      })
    )
  );
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath(`/coach/matchs/${matchId}`);
}

export async function updateStatRow(matchId: string, playerId: string, formData: FormData) {
  const { match } = await assertMatchAccess(matchId);
  await assertPlayerOnMatchTeam(match.team.category, playerId);
  const noteRaw = formData.get("note");
  const parsed = statRowSchema.safeParse({
    role: String(formData.get("role") || ""),
    position: String(formData.get("position") || "").trim() || null,
    minutes: Number(formData.get("minutes")),
    goals: Number(formData.get("goals")),
    assists: Number(formData.get("assists")),
    note: noteRaw ? Number(noteRaw) : null,
    comment: String(formData.get("comment") || "").trim() || null,
  });
  if (!parsed.success) return;
  await prisma.matchPlayerStat.update({
    where: { matchId_playerId: { matchId, playerId } },
    data: parsed.data,
  });
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath(`/coach/matchs/${matchId}`);
}

const BILAN_FIELDS = ["objectiveStatus", "collectiveNote", "firstHalfNote", "secondHalfNote", "positivePoints", "improvementAreas", "notableEvents"] as const;

// Mode brouillon (V5.2 §41) : the coach can fill the bilan in several
// passes — a quick "objectif" pick pitch-side, the rest later from the
// Cockpit. Only fields actually present in this particular submission are
// touched; a mobile quick-form that only sends objectiveStatus must never
// blank out collectiveNote/firstHalfNote/... already recorded elsewhere.
export async function updateBilan(matchId: string, formData: FormData) {
  await assertMatchAccess(matchId);
  const submitted = BILAN_FIELDS.filter((f) => formData.has(f));
  if (submitted.length === 0) return;

  const raw: Partial<Record<(typeof BILAN_FIELDS)[number], string | null>> = {};
  for (const f of submitted) {
    const v = String(formData.get(f) || "");
    raw[f] = f === "objectiveStatus" ? v || null : v;
  }
  const parsed = bilanSchema.partial().safeParse(raw);
  if (!parsed.success) return;
  await prisma.match.update({ where: { id: matchId }, data: parsed.data });
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath(`/coach/matchs/${matchId}`);
}

export async function updateMatch(matchId: string, formData: FormData) {
  const { match: current } = await assertMatchAccess(matchId);
  const opponent = String(formData.get("opponent") || "") || null;
  const competitionParsed = competitionSchema.safeParse(String(formData.get("competition")));
  const date = new Date(String(formData.get("date")));
  const time = String(formData.get("time") || "") || null;
  const isHome = formData.get("isHome") === "on";
  const location = String(formData.get("location") || "") || null;
  const surfaceRaw = String(formData.get("surface") || "");
  const surface = SURFACE_TYPES.includes(surfaceRaw as (typeof SURFACE_TYPES)[number]) ? surfaceRaw : null;
  const meetLocation = String(formData.get("meetLocation") || "").trim() || null;
  const neededParsed = neededSchema.safeParse(Number(formData.get("needed")));
  const preMatchObjective = String(formData.get("preMatchObjective") || "").trim() || null;
  const mainInstructions = String(formData.get("mainInstructions") || "").trim() || null;
  const preMatchNotes = String(formData.get("preMatchNotes") || "").trim() || null;
  const tournamentRankingRaw = String(formData.get("tournamentRanking") || "").trim();
  const tournamentTeamsCountRaw = String(formData.get("tournamentTeamsCount") || "").trim();
  const tournamentParsed = tournamentSchema.safeParse({
    tournamentRanking: tournamentRankingRaw ? Number(tournamentRankingRaw) : null,
    tournamentTeamsCount: tournamentTeamsCountRaw ? Number(tournamentTeamsCountRaw) : null,
  });
  if (!competitionParsed.success || Number.isNaN(date.getTime()) || !neededParsed.success || !tournamentParsed.success) return;
  const needed = neededParsed.data;
  const settings = await getSettings();

  // Modèle de match (§7-8) : "" = laisser le choix automatique se refaire
  // à chaque enregistrement (compétition/domicile-extérieur ont pu changer) ;
  // un choix explicite du formulaire est toujours respecté tel quel.
  const venueId = String(formData.get("venueId") || "") || null;
  const matchTemplateIdRaw = String(formData.get("matchTemplateId") || "");
  const [venue, explicitTemplate, allTemplates] = await Promise.all([
    venueId ? prisma.venue.findUnique({ where: { id: venueId } }) : Promise.resolve(null),
    matchTemplateIdRaw ? prisma.matchTemplate.findUnique({ where: { id: matchTemplateIdRaw } }) : Promise.resolve(null),
    matchTemplateIdRaw ? Promise.resolve([]) : prisma.matchTemplate.findMany(),
  ]);
  const template = explicitTemplate ?? (matchTemplateIdRaw ? null : selectMatchTemplate(allTemplates, { competition: competitionParsed.data, isHome }));

  // Fiche de convocation parent (Cockpit v1.1 §3, étendu par le système
  // d'héritage) — infos pratiques distinctes des champs tactiques
  // (preMatchObjective/mainInstructions/preMatchNotes ci-dessus, jamais
  // montrés aux parents).
  const meetTimeOverride = String(formData.get("meetTime") || "").trim() || null;
  const estimatedEndOverride = String(formData.get("estimatedEndTime") || "").trim() || null;
  const estimatedReturnOverride = String(formData.get("estimatedReturnTime") || "").trim() || null;
  const venueAddress = String(formData.get("venueAddress") || "").trim() || venue?.address || null;
  const transportModeRaw = String(formData.get("transportMode") || "");
  const transportModeOverride = TRANSPORT_MODES.includes(transportModeRaw as (typeof TRANSPORT_MODES)[number]) ? transportModeRaw : null;
  const dressCodeOverride = String(formData.get("dressCode") || "").trim() || null;
  const personalGearOverride = String(formData.get("personalGear") || "").trim() || null;
  const mealInfoOverride = String(formData.get("mealInfo") || "").trim() || null;
  const parentInstructionsOverride = String(formData.get("parentInstructions") || "").trim() || null;
  const parentNotes = String(formData.get("parentNotes") || "").trim() || null;

  const resolved = resolveParentInfoFields({
    kickoffTime: time,
    meetTimeOverride,
    estimatedEndOverride,
    estimatedReturnOverride,
    transportModeOverride,
    dressCodeOverride,
    personalGearOverride,
    mealInfoOverride,
    parentInstructionsOverride,
    template,
    team: current.team,
    globalDelaiRdv: settings.delaiRdv,
  });

  await prisma.match.update({
    where: { id: matchId },
    data: {
      opponent, competition: competitionParsed.data, date, time,
      meetTime: resolved.meetTime,
      meetLocation,
      isHome,
      location: location || venue?.name || null,
      surface, needed, preMatchObjective, mainInstructions, preMatchNotes,
      estimatedEndTime: resolved.estimatedEndTime,
      estimatedReturnTime: resolved.estimatedReturnTime,
      venueAddress,
      transportMode: resolved.transportMode,
      dressCode: resolved.dressCode,
      personalGear: resolved.personalGear,
      mealInfo: resolved.mealInfo,
      parentInstructions: resolved.parentInstructions,
      parentNotes,
      venueId,
      matchTemplateId: template?.id ?? null,
      ...tournamentParsed.data,
    },
  });
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath("/matchs");
  revalidatePath("/planning");
  revalidatePath("/");
}

export async function cancelMatch(matchId: string) {
  const { user } = await assertMatchAccess(matchId);
  const match = await prisma.match.update({ where: { id: matchId }, data: { status: "Annulé" }, include: { team: true } });
  await logActivity({
    actorId: user.id,
    summary: `a annulé le match ${match.team.code} vs ${match.opponent ?? "adversaire à définir"}`,
    entityType: "Match",
    entityId: matchId,
  });
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath("/matchs");
  revalidatePath("/planning");
  revalidatePath("/");
}

export async function deleteMatch(matchId: string) {
  const { user } = await assertMatchAccess(matchId);
  const match = await prisma.match.delete({ where: { id: matchId }, include: { team: true } });
  await logActivity({
    actorId: user.id,
    summary: `a supprimé le match ${match.team.code} vs ${match.opponent ?? "adversaire à définir"}`,
    entityType: "Match",
    entityId: matchId,
  });
  revalidatePath("/matchs");
  revalidatePath("/planning");
  revalidatePath("/");
  redirect("/matchs");
}

// Creating a fixture is a categoy-management decision (which weekend the
// team plays, against whom), not day-to-day coaching — so it needs
// Responsable-level coverage of the team's category, the same bar as
// createTeam. A Coach-only grant (e.g. Davy on U12) can see and prepare
// matches created for them, but not add new ones themselves.
export async function createMatch(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get("teamId"));
  if (!canAccessTeam(user, teamId)) return;
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return;
  if (user.role !== "ADMIN" && !canManageCategory(user, team.category)) redirect("/matchs");
  const opponent = String(formData.get("opponent") || "") || null;
  const competitionParsed = competitionSchema.safeParse(String(formData.get("competition")));
  const date = new Date(String(formData.get("date")));
  const time = String(formData.get("time") || "") || null;
  const isHome = formData.get("isHome") === "on";
  const location = String(formData.get("location") || "") || null;
  const surfaceRaw = String(formData.get("surface") || "");
  const surface = SURFACE_TYPES.includes(surfaceRaw as (typeof SURFACE_TYPES)[number]) ? surfaceRaw : null;
  const meetLocation = String(formData.get("meetLocation") || "").trim() || null;
  const neededParsed = neededSchema.safeParse(Number(formData.get("needed")));
  if (!competitionParsed.success || Number.isNaN(date.getTime()) || !neededParsed.success) return;
  const needed = neededParsed.data;
  const settings = await getSettings();

  // Modèle de match sélectionné automatiquement (§8) selon compétition +
  // domicile/extérieur, sauf choix explicite sur le formulaire.
  const venueId = String(formData.get("venueId") || "") || null;
  const matchTemplateIdRaw = String(formData.get("matchTemplateId") || "");
  const [venue, explicitTemplate, allTemplates] = await Promise.all([
    venueId ? prisma.venue.findUnique({ where: { id: venueId } }) : Promise.resolve(null),
    matchTemplateIdRaw ? prisma.matchTemplate.findUnique({ where: { id: matchTemplateIdRaw } }) : Promise.resolve(null),
    matchTemplateIdRaw ? Promise.resolve([]) : prisma.matchTemplate.findMany(),
  ]);
  const template = explicitTemplate ?? (matchTemplateIdRaw ? null : selectMatchTemplate(allTemplates, { competition: competitionParsed.data, isHome }));

  const meetTimeOverride = String(formData.get("meetTime") || "").trim() || null;
  const estimatedEndOverride = String(formData.get("estimatedEndTime") || "").trim() || null;
  const estimatedReturnOverride = String(formData.get("estimatedReturnTime") || "").trim() || null;
  const venueAddress = String(formData.get("venueAddress") || "").trim() || venue?.address || null;
  const transportModeRaw = String(formData.get("transportMode") || "");
  const transportModeOverride = TRANSPORT_MODES.includes(transportModeRaw as (typeof TRANSPORT_MODES)[number]) ? transportModeRaw : null;
  const dressCodeOverride = String(formData.get("dressCode") || "").trim() || null;
  const personalGearOverride = String(formData.get("personalGear") || "").trim() || null;
  const mealInfoOverride = String(formData.get("mealInfo") || "").trim() || null;
  const parentInstructionsOverride = String(formData.get("parentInstructions") || "").trim() || null;

  const resolved = resolveParentInfoFields({
    kickoffTime: time,
    meetTimeOverride,
    estimatedEndOverride,
    estimatedReturnOverride,
    transportModeOverride,
    dressCodeOverride,
    personalGearOverride,
    mealInfoOverride,
    parentInstructionsOverride,
    template,
    team,
    globalDelaiRdv: settings.delaiRdv,
  });

  const match = await prisma.match.create({
    data: {
      teamId, opponent, competition: competitionParsed.data, date, time,
      meetTime: resolved.meetTime,
      meetLocation,
      isHome,
      location: location || venue?.name || null,
      surface, needed, status: "Planifié",
      estimatedEndTime: resolved.estimatedEndTime,
      estimatedReturnTime: resolved.estimatedReturnTime,
      venueAddress,
      transportMode: resolved.transportMode,
      dressCode: resolved.dressCode,
      personalGear: resolved.personalGear,
      mealInfo: resolved.mealInfo,
      parentInstructions: resolved.parentInstructions,
      venueId,
      matchTemplateId: template?.id ?? null,
    },
  });
  revalidatePath("/matchs");
  revalidatePath("/planning");
  revalidatePath("/");
  redirect(`/matchs/${match.id}`);
}

// Expected columns (header row, case-insensitive, order-independent), from
// this club's own federation exports: ADVERSAIRE, DATE DU MATCH — the rest
// (Equipe, heures, lieu) is optional. See src/lib/match-import.ts for the
// column-detection and row-mapping rules.
export async function importMatches(formData: FormData) {
  const user = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/matchs/importer?error=${encodeURIComponent("Aucun fichier sélectionné.")}`);
  }

  const competitionParsed = competitionSchema.safeParse(String(formData.get("competition") || "Championnat"));
  const defaultCompetition = competitionParsed.success ? competitionParsed.data : "Championnat";
  const neededParsed = neededSchema.safeParse(Number(formData.get("needed") || 12));
  const defaultNeeded = neededParsed.success ? neededParsed.data : 12;
  const fallbackTeamIdRaw = String(formData.get("teamId") || "");
  const fallbackTeamId = fallbackTeamIdRaw && canAccessTeam(user, fallbackTeamIdRaw) ? fallbackTeamIdRaw : null;

  let grid;
  try {
    grid = readXlsxFirstSheetGrid(Buffer.from(await file.arrayBuffer()));
  } catch {
    redirect(`/matchs/importer?error=${encodeURIComponent("Fichier illisible — un fichier .xlsx est attendu.")}`);
  }

  const rawRows = extractMatchRows(grid);
  if (rawRows.length === 0) {
    redirect(
      `/matchs/importer?error=${encodeURIComponent("Aucune ligne de match reconnue — colonnes attendues : Adversaire, Date du match.")}`
    );
  }

  const allTeams = await prisma.team.findMany();
  const teams = allTeams.map((t) => ({ id: t.id, code: t.code, allowed: canAccessTeam(user, t.id) }));
  const outcomes = buildMatchImportCandidates(rawRows, { defaultCompetition, defaultNeeded, teams, fallbackTeamId });

  const involvedTeamIds = [...new Set(outcomes.filter((o) => o.ok).map((o) => o.candidate.teamId))];
  const existingMatches = await prisma.match.findMany({
    where: { teamId: { in: involvedTeamIds } },
    select: { teamId: true, date: true, opponent: true },
  });
  // Re-importing the same calendar (or an updated version of it) shouldn't
  // create duplicate fixtures — a match is the same one if it's the same
  // team, same day, same opponent text (both null for a still-unconfirmed
  // opponent counts as a match).
  const existingKeys = new Set(
    existingMatches.map((m) => `${m.teamId}|${m.date.toISOString().slice(0, 10)}|${(m.opponent ?? "").toLowerCase()}`)
  );

  const settings = await getSettings();
  let imported = 0;
  let duplicates = 0;
  let skipped = 0;
  for (const outcome of outcomes) {
    if (!outcome.ok) {
      skipped++;
      continue;
    }
    const c = outcome.candidate;
    const key = `${c.teamId}|${c.date.toISOString().slice(0, 10)}|${(c.opponent ?? "").toLowerCase()}`;
    if (existingKeys.has(key)) {
      duplicates++;
      continue;
    }
    await prisma.match.create({
      data: {
        teamId: c.teamId,
        opponent: c.opponent,
        competition: c.competition,
        date: c.date,
        time: c.time,
        meetTime: computeMeetTime(c.time, settings.delaiRdv),
        isHome: c.isHome,
        location: c.location,
        needed: c.needed,
        status: "Planifié",
      },
    });
    existingKeys.add(key);
    imported++;
  }

  await logActivity({
    actorId: user.id,
    summary: `a importé ${imported} match(s) via Excel (${duplicates} déjà existant(s), ${skipped} ignoré(s))`,
    entityType: "Match",
  });
  revalidatePath("/matchs");
  revalidatePath("/planning");
  revalidatePath("/");
  redirect(`/matchs/importer?imported=${imported}&duplicates=${duplicates}&skipped=${skipped}`);
}
