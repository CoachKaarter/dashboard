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
} from "@/lib/match-validation";
import { readXlsxFirstSheetGrid, extractMatchRows, buildMatchImportCandidates } from "@/lib/match-import";

function computeMeetTime(time: string | null, delaiRdv: number): string | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m - delaiRdv;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

async function assertMatchAccess(matchId: string) {
  const user = await requireUser();
  const match = await prisma.match.findUniqueOrThrow({
    where: { id: matchId },
    select: { teamId: true, date: true, formation: true, team: { select: { format: true, category: true } } },
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

export async function toggleConvocation(matchId: string, playerId: string) {
  const { match } = await assertMatchAccess(matchId);
  await assertPlayerOnMatchTeam(match.team.category, playerId);
  const existing = await prisma.matchConvocation.findUnique({
    where: { matchId_playerId: { matchId, playerId } },
  });
  if (existing) {
    await prisma.matchConvocation.delete({ where: { id: existing.id } });
    // also drop any composition slot for that player on this match
    await prisma.compositionSlot.deleteMany({ where: { matchId, playerId } });
  } else {
    await assertNoSameDayConflict(matchId, match.teamId, match.date, playerId);
    await prisma.matchConvocation.create({ data: { matchId, playerId } });
  }
  revalidatePath(`/matchs/${matchId}`);
  revalidatePath(`/coach/matchs/${matchId}`);
  revalidatePath("/matchs");
  revalidatePath("/");
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
  await assertMatchAccess(matchId);
  const opponent = String(formData.get("opponent") || "") || null;
  const competitionParsed = competitionSchema.safeParse(String(formData.get("competition")));
  const date = new Date(String(formData.get("date")));
  const time = String(formData.get("time") || "") || null;
  const isHome = formData.get("isHome") === "on";
  const location = String(formData.get("location") || "") || null;
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

  await prisma.match.update({
    where: { id: matchId },
    data: {
      opponent, competition: competitionParsed.data, date, time,
      meetTime: computeMeetTime(time, settings.delaiRdv),
      meetLocation,
      isHome, location, needed, preMatchObjective, mainInstructions, preMatchNotes,
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
  const meetLocation = String(formData.get("meetLocation") || "").trim() || null;
  const neededParsed = neededSchema.safeParse(Number(formData.get("needed")));
  if (!competitionParsed.success || Number.isNaN(date.getTime()) || !neededParsed.success) return;
  const needed = neededParsed.data;
  const settings = await getSettings();

  const match = await prisma.match.create({
    data: {
      teamId, opponent, competition: competitionParsed.data, date, time,
      meetTime: computeMeetTime(time, settings.delaiRdv),
      meetLocation,
      isHome, location, needed, status: "Planifié",
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
