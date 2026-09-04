export type DistributionEntry = { value: string; count: number; pct: number };

export function computeDistribution(values: string[]): DistributionEntry[] {
  const total = values.length;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

// A player no longer has a fixed team by default (see Player.teamId,
// nullable) — this is THE way "which team is this player really on right
// now" gets answered wherever Player.teamId is null: whichever team they've
// actually played the most matches with. null when they haven't played any
// yet (the "à affecter" case on /équipes).
export function computeUsualTeamCode(teamCodes: string[]): string | null {
  const distribution = computeDistribution(teamCodes);
  return distribution[0]?.value ?? null;
}
