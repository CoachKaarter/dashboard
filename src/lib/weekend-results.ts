/**
 * Résultats des matchs joués un week-end donné, formatés pour le message
 * d'ouverture des disponibilités (src/lib/message-templates.ts, variable
 * {{resultats}}) — voir "Ajoute les résultats du week-end" côté /parametres
 * et /disponibilites.
 *
 * Une seule source de vérité pour le résultat (Victoire/Nul/Défaite) :
 * computeMatchResult (src/lib/match-phase.ts), la même que la feuille de
 * match et le rapport de match. Rien n'est recalculé ni stocké ici.
 */
import { prisma } from "@/lib/prisma";
import { computeMatchResult, RESULT_LABEL_FR } from "@/lib/match-phase";

export type WeekendResultMatch = {
  teamId: string;
  teamCode: string;
  status: string; // "Planifié" | "Joué" | "Annulé"
  competition: string;
  opponent: string | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
  tournamentRanking: number | null;
  tournamentTeamsCount: number | null;
};

/**
 * Pure — une ligne "ÉQUIPE — Résultat" ou null si le match n'a rien
 * d'exploitable : pas encore joué, annulé, ou joué sans score ni classement
 * de tournoi (§7/§12). The status check is a defense-in-depth mirror of the
 * `where: { status: "Joué" }` in getWeekendResults' own query below — same
 * rule enforced twice, not two different rules. Un match de tournoi avec un
 * score final (ex. finale décisive) est traité comme un match normal : le
 * score prime sur le classement quand les deux existent.
 */
export function formatWeekendResultLine(m: WeekendResultMatch): string | null {
  if (m.status !== "Joué") return null;
  if (m.scoreFor !== null && m.scoreAgainst !== null) {
    const result = computeMatchResult(m.scoreFor, m.scoreAgainst);
    return `${m.teamCode} — ${RESULT_LABEL_FR[result]} ${m.scoreFor}-${m.scoreAgainst} vs ${m.opponent ?? "adversaire à définir"}`;
  }
  if (m.competition === "Tournoi" && m.tournamentRanking !== null && m.tournamentTeamsCount !== null) {
    const host = m.opponent ? ` de ${m.opponent}` : "";
    return `${m.teamCode} — Tournoi${host} — ${m.tournamentRanking}e / ${m.tournamentTeamsCount} équipes`;
  }
  return null;
}

/**
 * Pure — teamIds est la liste déjà scopée par les permissions de
 * l'appelant (mêmes scopedTeamIds/catégorie active que la page
 * /disponibilites elle-même — jamais recalculée ici). Un filtre défensif
 * en plus du `where` de la requête, pas un deuxième moteur de permissions.
 */
export function selectWeekendResultLines(matches: WeekendResultMatch[], teamIds: string[]): string[] {
  const allowed = new Set(teamIds);
  return matches
    .filter((m) => allowed.has(m.teamId))
    .map(formatWeekendResultLine)
    .filter((line): line is string => line !== null);
}

/**
 * Résultats pour UN samedi (weekendDate — même notion que getWeekendDate /
 * getWeekendBoard, jamais "les 7 derniers jours"), restreints à teamIds.
 * Une seule requête, colonnes minimales — pas de N+1 par équipe.
 */
export async function getWeekendResults(weekendDate: Date, teamIds: string[]): Promise<string[]> {
  if (teamIds.length === 0) return [];
  const matches = await prisma.match.findMany({
    where: { teamId: { in: teamIds }, date: weekendDate, status: "Joué" },
    select: {
      teamId: true,
      status: true,
      opponent: true,
      competition: true,
      scoreFor: true,
      scoreAgainst: true,
      tournamentRanking: true,
      tournamentTeamsCount: true,
      team: { select: { code: true } },
    },
    orderBy: { team: { code: "asc" } },
  });
  const rows: WeekendResultMatch[] = matches.map((m) => ({
    teamId: m.teamId,
    teamCode: m.team.code,
    status: m.status,
    competition: m.competition,
    opponent: m.opponent,
    scoreFor: m.scoreFor,
    scoreAgainst: m.scoreAgainst,
    tournamentRanking: m.tournamentRanking,
    tournamentTeamsCount: m.tournamentTeamsCount,
  }));
  return selectWeekendResultLines(rows, teamIds);
}
