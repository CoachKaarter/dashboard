import { computeUsualTeamCode } from "@/lib/player-history";

export type RosterPlayer = {
  id: string;
  teamId: string | null;
  matchTeamCodes: string[]; // team codes from this player's MatchPlayerStat history
};

export type CategoryRosterPartition<T> = {
  // On this team's own roster (teamId fixed here, or no fixed team but the
  // team they've played the most matches with) — the team's real effectif.
  fixed: T[];
  calculated: T[];
  // Category-wide: no fixed team AND no match history to compute one from
  // yet — same list regardless of which team of the category is viewed.
  unassigned: T[];
};

// A player floats freely across the teams of their category by default
// (Player.teamId nullable) — this decides, for one specific team's roster
// page, which category players actually belong there: either explicitly
// fixed on it (staff override via "Changer de groupe"), or — when unfixed —
// the team they've actually played the most matches with (computeUsualTeamCode,
// see player-history.ts). A player fixed on, or computed onto, a SIBLING
// team of the same category is deliberately excluded here (they belong on
// that other team's page instead).
export function partitionCategoryRoster<T extends RosterPlayer>(
  categoryPlayers: T[],
  team: { id: string; code: string }
): CategoryRosterPartition<T> {
  const fixed: T[] = [];
  const calculated: T[] = [];
  const unassigned: T[] = [];
  for (const p of categoryPlayers) {
    if (p.teamId === team.id) {
      fixed.push(p);
      continue;
    }
    if (p.teamId !== null) continue;
    const usual = computeUsualTeamCode(p.matchTeamCodes);
    if (usual === team.code) calculated.push(p);
    else if (usual === null) unassigned.push(p);
  }
  return { fixed, calculated, unassigned };
}
