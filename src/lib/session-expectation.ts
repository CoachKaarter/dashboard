/**
 * V6 — effectif attendu par séance (SessionExpectation).
 *
 * Décision d'organisation STAFF, distincte de PlayerAvailability (réponse
 * FAMILLE, voir src/lib/availability.ts) et d'Attendance (présence RÉELLE,
 * pointée par le coach, voir src/app/(app)/seances/actions.ts). Aucune des
 * trois ne doit jamais réécrire les deux autres.
 *
 * Comme session-scope.ts / session-lifecycle.ts : décisions pures et
 * testables sans base de données, wrappers DB fins autour.
 */
import { prisma } from "@/lib/prisma";

export type SessionForExpectation = { scopeTeamId: string | null; category: string };
export type NaturalScopePlayer = { id: string };

/**
 * Pure — joueurs du scope naturel de la séance qui n'ont pas encore de
 * ligne SessionExpectation. Même contrat que playersNeedingDefaultPresence
 * (session-lifecycle.ts) : ne décide jamais de réécrire une ligne existante.
 */
export function playersNeedingExpectationInit<T extends NaturalScopePlayer>(
  naturalPlayers: T[],
  existingPlayerIds: Set<string>
): T[] {
  return naturalPlayers.filter((p) => !existingPlayerIds.has(p.id));
}

/**
 * Idempotente et auto-réparatrice : initialise "attendu" pour tout joueur du
 * scope naturel (équipe si scopeTeamId, sinon catégorie) qui n'a encore
 * AUCUNE ligne pour cette séance — ne modifie jamais une ligne déjà
 * présente, qu'elle soit attendu=true ou false. Appelée à chaque point de
 * lecture/écriture de l'effectif attendu (fiche séance staff/coach, accueil
 * Coach, planning Parent) plutôt qu'uniquement à la création de la séance :
 * une séance générée par RecurringSlot est ainsi initialisée au premier
 * accès, sans avoir à modifier le générateur bulk existant.
 */
export async function ensureSessionExpectations(sessionId: string): Promise<void> {
  const session = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { scopeTeamId: true, category: true },
  });
  const naturalPlayers = await prisma.player.findMany({
    where: {
      archived: false,
      ...(session.scopeTeamId ? { teamId: session.scopeTeamId } : { team: { category: session.category } }),
    },
    select: { id: true },
  });
  const existing = await prisma.sessionExpectation.findMany({ where: { sessionId }, select: { playerId: true } });
  const existingIds = new Set(existing.map((e) => e.playerId));
  const missing = playersNeedingExpectationInit(naturalPlayers, existingIds);
  if (missing.length === 0) return;
  await prisma.sessionExpectation.createMany({
    data: missing.map((p) => ({ sessionId, playerId: p.id, expected: true })),
    skipDuplicates: true, // sécurité si deux vues concurrentes déclenchent l'init en même temps
  });
}

export type CategoryScopedPlayer = { archived: boolean; category: string };

/**
 * Pure — scope CATÉGORIE large (pas équipe), pour les ajouts exceptionnels :
 * un joueur U13B doit pouvoir devenir attendu sur une séance scopée U13A,
 * tant qu'il reste dans la même catégorie. Même rôle qu'assertPlayerOnMatchTeam
 * côté Match (matchs/actions.ts).
 */
export function playerInSessionCategory(session: SessionForExpectation, player: CategoryScopedPlayer): boolean {
  if (player.archived) return false;
  return player.category === session.category;
}

/** Throws unless playerId est un joueur actif de la même catégorie que la séance. */
export async function assertPlayerInSessionCategory(sessionId: string, playerId: string) {
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  const player = await prisma.player.findUnique({ where: { id: playerId }, include: { team: true } });
  if (!player || !playerInSessionCategory(session, player)) throw new Error("Joueur invalide pour cette séance.");
  return player;
}

export type RosterExpectation = { playerId: string; expected: boolean };
export type RosterAvailability = { playerId: string; status: "AVAILABLE" | "UNAVAILABLE" };
export type RosterSummary = { expected: number; announcedPresent: number; announcedAbsent: number; noResponse: number };

/**
 * Pure — formules exactes du brief V6 §22 : ATTENDUS = expected=true ;
 * parmi eux, ANNONCÉS PRÉSENTS/ABSENTS = réponse PlayerAvailability
 * correspondante ; SANS RÉPONSE = aucune PlayerAvailability. N'utilise
 * jamais Attendance (réservé au pointage terrain post-appel).
 */
export function computeRosterSummary(expectations: RosterExpectation[], availabilities: RosterAvailability[]): RosterSummary {
  const availByPlayer = new Map(availabilities.map((a) => [a.playerId, a.status]));
  const expected = expectations.filter((e) => e.expected);
  let announcedPresent = 0;
  let announcedAbsent = 0;
  let noResponse = 0;
  for (const e of expected) {
    const status = availByPlayer.get(e.playerId);
    if (status === "AVAILABLE") announcedPresent++;
    else if (status === "UNAVAILABLE") announcedAbsent++;
    else noResponse++;
  }
  return { expected: expected.length, announcedPresent, announcedAbsent, noResponse };
}

/**
 * Pure — un parent ne doit être invité à répondre présent/absent que si son
 * enfant est attendu à la séance ET que la séance n'est pas annulée. Un
 * joueur non attendu ne doit jamais être sollicité, et ne doit jamais être
 * comptabilisé "absent" (§26/§27 du brief).
 */
export function shouldPromptForSessionAvailability(session: { status: string }, expected: boolean | null | undefined): boolean {
  return expected !== false && session.status !== "Annulée";
}
