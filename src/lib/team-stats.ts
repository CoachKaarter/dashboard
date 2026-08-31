import { computeMatchResult, type MatchResult } from "./match-phase";

export type PlayedMatch = {
  scoreFor: number;
  scoreAgainst: number;
  date: Date;
};

export type PlayedMatchSource = {
  competition: string;
  scoreFor: number | null;
  scoreAgainst: number | null;
  date: Date;
  plateauResults: { scoreFor: number | null; scoreAgainst: number | null }[];
};

/**
 * Un plateau n'a pas un score unique : chaque rencontre du plateau compte
 * comme un résultat séparé pour les statistiques (victoires/nuls/défaites,
 * buts), au lieu du match lui-même qui n'a pas de scoreFor/scoreAgainst.
 */
export function flattenPlayedMatches(matches: PlayedMatchSource[]): PlayedMatch[] {
  const out: PlayedMatch[] = [];
  for (const m of matches) {
    if (m.competition === "Plateau") {
      for (const r of m.plateauResults) {
        if (r.scoreFor !== null && r.scoreAgainst !== null) {
          out.push({ scoreFor: r.scoreFor, scoreAgainst: r.scoreAgainst, date: m.date });
        }
      }
    } else if (m.scoreFor !== null && m.scoreAgainst !== null) {
      out.push({ scoreFor: m.scoreFor, scoreAgainst: m.scoreAgainst, date: m.date });
    }
  }
  return out;
}

export type TeamStats = {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  winPct: number;
  avgGoalsFor: number;
  avgGoalsAgainst: number;
};

export function computeTeamStats(matches: PlayedMatch[]): TeamStats {
  const played = matches.length;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (const m of matches) {
    goalsFor += m.scoreFor;
    goalsAgainst += m.scoreAgainst;
    const result = computeMatchResult(m.scoreFor, m.scoreAgainst);
    if (result === "GAGNE") wins++;
    else if (result === "NUL") draws++;
    else losses++;
  }

  return {
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDiff: goalsFor - goalsAgainst,
    winPct: played > 0 ? Math.round((wins / played) * 100) : 0,
    avgGoalsFor: played > 0 ? Math.round((goalsFor / played) * 10) / 10 : 0,
    avgGoalsAgainst: played > 0 ? Math.round((goalsAgainst / played) * 10) / 10 : 0,
  };
}

export function computeForm(matches: PlayedMatch[], n: number): MatchResult[] {
  return matches
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(-n)
    .map((m) => computeMatchResult(m.scoreFor, m.scoreAgainst));
}
