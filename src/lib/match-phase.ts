/**
 * V5.2 — Match lifecycle, computed rather than stored (§43: "données
 * calculées, pas stockées inutilement"). Match.status in the DB stays
 * exactly {"Planifié" | "Joué" | "Annulé"} — the only genuine staff
 * decisions that aren't derivable from anything else. Convoqué/Prêt/
 * Analysé are display-layer phases layered on top from data that already
 * exists (convocations, composition slots, bilan fields), so there is
 * never a second source of truth that can drift from the real data.
 */
export type MatchPhase = "PLANIFIE" | "CONVOQUE" | "PRET" | "JOUE" | "ANALYSE" | "ANNULE";

export function computeMatchPhase(input: {
  status: string; // "Planifié" | "Joué" | "Annulé"
  convocationCount: number;
  startersCount: number; // composition slots filled
  neededStarters: number; // positions in the active formation
  bilanFilled: boolean; // collectiveNote or objectiveStatus set
}): MatchPhase {
  if (input.status === "Annulé") return "ANNULE";
  if (input.status === "Joué") return input.bilanFilled ? "ANALYSE" : "JOUE";
  // status === "Planifié"
  if (input.convocationCount === 0) return "PLANIFIE";
  if (input.startersCount < input.neededStarters) return "CONVOQUE";
  return "PRET";
}

export type MatchResult = "GAGNE" | "NUL" | "PERDU";

/** scoreFor/scoreAgainst are the only stored facts — G/N/P and goal difference are always derived from them, never re-entered (§8). */
export function computeMatchResult(scoreFor: number, scoreAgainst: number): MatchResult {
  if (scoreFor > scoreAgainst) return "GAGNE";
  if (scoreFor < scoreAgainst) return "PERDU";
  return "NUL";
}

export function computeGoalDifference(scoreFor: number, scoreAgainst: number): number {
  return scoreFor - scoreAgainst;
}

// Single source of truth for the French label of a MatchResult — reused by
// the match report page and the weekend-results message block (src/lib/
// weekend-results.ts) so the two never drift into slightly different wording.
export const RESULT_LABEL_FR: Record<MatchResult, string> = { GAGNE: "Victoire", NUL: "Match nul", PERDU: "Défaite" };

/**
 * Cockpit v1.1 §2 — l'espace parent ne doit plus jamais afficher "Match"
 * comme titre générique. Match.competition est déjà obligatoire en base
 * (jamais null) ; ceci n'est qu'un affichage badge/titre lisible, avec un
 * filet de sécurité neutre ("RENCONTRE") pour toute valeur imprévue —
 * jamais "MATCH" en repli.
 */
const COMPETITION_BADGE_LABEL: Record<string, string> = {
  Championnat: "CHAMPIONNAT",
  Amical: "AMICAL",
  Tournoi: "TOURNOI",
  Coupe: "COUPE",
  Plateau: "PLATEAU",
};

export function matchTypeBadge(competition: string | null | undefined): string {
  if (!competition) return "RENCONTRE";
  return COMPETITION_BADGE_LABEL[competition] ?? "RENCONTRE";
}
