/**
 * Pré-V5 hardening (Partie B/C) — a session's Server Actions verify the
 * *coach* has access to the session (`canAccessSession`), but that alone
 * doesn't verify a given `playerId`/`blockId` actually belongs to that
 * session's scope. A hand-crafted request pairing a valid session with an
 * out-of-scope player/block must be refused server-side, not just hidden
 * client-side.
 *
 * The actual scope decisions are plain, DB-free functions so they can be
 * unit-tested directly (no live database needed in this environment) —
 * `assertPlayerInSessionScope`/`assertBlockBelongsToSession` are thin
 * fetch-then-decide wrappers around them.
 */
import { prisma } from "@/lib/prisma";

export type SessionScope = { scopeTeamId: string | null; category: string };
export type ScopedPlayer = { teamId: string | null; category: string; archived: boolean };

/** Pure decision — no DB access — so it's directly unit-testable. */
export function playerMatchesSessionScope(session: SessionScope, player: ScopedPlayer): boolean {
  if (player.archived) return false;
  return session.scopeTeamId ? player.teamId === session.scopeTeamId : player.category === session.category;
}

/** Pure decision — no DB access — so it's directly unit-testable. */
export function blockMatchesSession(block: { sessionId: string } | null, sessionId: string): boolean {
  return block !== null && block.sessionId === sessionId;
}

/**
 * Throws unless `playerId` is a real, non-archived player within
 * `sessionId`'s scope (its explicit team if `scopeTeamId` is set,
 * otherwise any team in the session's category).
 */
export async function assertPlayerInSessionScope(sessionId: string, playerId: string) {
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  const player = await prisma.player.findUnique({ where: { id: playerId }, include: { team: true } });
  if (!player || !playerMatchesSessionScope(session, player)) throw new Error("Joueur invalide pour cette séance.");
  return player;
}

/** Throws unless `blockId` is a real block that belongs to `sessionId`. */
export async function assertBlockBelongsToSession(sessionId: string, blockId: string) {
  const block = await prisma.sessionBlock.findUnique({ where: { id: blockId } });
  if (!blockMatchesSession(block, sessionId)) throw new Error("Procédé invalide pour cette séance.");
  return block!;
}
