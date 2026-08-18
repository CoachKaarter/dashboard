/**
 * V5.1 Partie AC/AG — "Générer les convocations" (§119) must be idempotent:
 * clicking Publier twice must never create a duplicate MatchConvocation.
 * This pure decision is the exact rule applied by generateWeekendConvocations
 * — extracted so it's testable without a live database.
 */
export type WeekendAssignmentForPublish = { playerId: string; matchId: string | null };

export function convocationsToCreate(
  assignments: WeekendAssignmentForPublish[],
  existingConvocationKeys: Set<string>
): { matchId: string; playerId: string }[] {
  const toCreate: { matchId: string; playerId: string }[] = [];
  const seen = new Set(existingConvocationKeys);
  for (const a of assignments) {
    if (!a.matchId) continue;
    const key = `${a.matchId}:${a.playerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    toCreate.push({ matchId: a.matchId, playerId: a.playerId });
  }
  return toCreate;
}
