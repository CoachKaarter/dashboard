import { formatDateFull } from "@/lib/format";
import { TRANSPORT_MODE_LABELS } from "@/lib/equipment";

// Feuille de convocation hebdomadaire (U12/U13) — poster HTML/CSS exporté en
// PNG depuis /week-end. Cette fonction est la SEULE source de vérité pour
// les données affichées : le message WhatsApp (déjà existant) et ce poster
// lisent tous les deux le même board (getWeekendBoard), jamais deux
// requêtes séparées qui pourraient diverger. Pure et testée : toute la
// logique de mise en forme/anomalies vit ici, jamais dans le composant.

const TODO = "À confirmer";

export type PosterPlayerInput = { firstName: string; lastName: string; playerId: string };

export type PosterTeamInput = {
  teamId: string;
  code: string;
  category: string;
  level: string | null;
};

export type PosterMatchInput = {
  matchId: string;
  teamId: string;
  date: Date;
  competition: string;
  opponent: string | null;
  isHome: boolean;
  location: string | null;
  surface: string | null;
  venueAddress: string | null;
  time: string | null;
  meetTime: string | null;
  meetLocation: string | null;
  estimatedEndTime: string | null;
  estimatedReturnTime: string | null;
  parentNotes: string | null;
  transportMode: string | null;
  players: PosterPlayerInput[]; // convoqués pour CE match, déjà résolus
  educateurs: string[];
  phone: string | null;
  dirigeants: string[];
  jerseyHolder: { name: string; dueDate: Date } | null;
};

export type PosterSideListsInput = {
  blesses: PosterPlayerInput[];
  absents: PosterPlayerInput[];
  // Tout joueur actif du périmètre, calculé par l'appelant (déjà exclu des
  // convoqués/blessés/absents) — voir buildNonConvoques ci-dessous pour la
  // règle exacte si l'appelant préfère la déléguer à cette fonction.
  nonConvoques: PosterPlayerInput[];
};

export type ConvocationPosterInput = {
  clubName: string;
  clubShortName: string | null; // ex. "SSFC" — utilisé dans le titre, jamais codé en dur ici
  seasonLabel: string; // ex. "2026/2027" — vient de Season.isCurrent (Paramètres), jamais déduit d'une date figée
  clubLogoUrl: string | null;
  teams: PosterTeamInput[]; // dans l'ordre d'affichage souhaité
  matchesByTeamId: Map<string, PosterMatchInput>;
  sideLists: PosterSideListsInput;
};

export type ConvocationPosterMatchView = {
  dateLabel: string;
  level: string; // "{category} {level}" ou "À confirmer"
  competition: string;
  opponent: string;
  location: string;
  surface: string;
  venueAddress: string;
  time: string;
  meetTime: string;
  meetLocation: string;
  estimatedEndTime: string;
  estimatedReturnTime: string;
  parentNotes: string;
  transportLabel: string;
  players: { number: number; name: string }[];
  educateurs: string;
  phone: string;
  dirigeants: string;
  jersey: string;
};

export type ConvocationPosterTeamColumn = {
  code: string;
  category: string;
  match: ConvocationPosterMatchView | null; // null = "Pas de match"
};

export type ConvocationPosterData = {
  title: string;
  clubName: string;
  clubLogoUrl: string | null;
  teams: ConvocationPosterTeamColumn[];
  sideColumn: { absents: string[]; nonConvoques: string[]; blesses: string[] };
  anomalies: string[];
};

function playerName(p: PosterPlayerInput) {
  return `${p.firstName} ${p.lastName}`;
}

/** Saison juillet→juin, utilisée seulement si aucune Season.isCurrent n'est configurée dans Paramètres. */
export function fallbackSeasonLabel(now: Date): string {
  const year = now.getFullYear();
  return now.getMonth() >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

function formatDueDate(d: Date) {
  return formatDateFull(d);
}

/** Ordre d'affichage standard : U13 avant U12, puis code alphabétique — ne suppose jamais de code exact ("U13A"…). */
export function sortPosterTeams<T extends { code: string; category: string }>(teams: T[]): T[] {
  const categoryRank = (c: string) => (c === "U13" ? 0 : c === "U12" ? 1 : 2);
  return [...teams].sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.code.localeCompare(b.code) || a.category.localeCompare(b.category));
}

export function buildConvocationPosterData(input: ConvocationPosterInput): ConvocationPosterData {
  const anomalies: string[] = [];
  const seenPlayerIds = new Map<string, string>(); // playerId -> where first seen

  function claim(playerId: string, where: string) {
    const existing = seenPlayerIds.get(playerId);
    if (existing && existing !== where) {
      anomalies.push(`Un joueur apparaît à la fois dans « ${existing} » et « ${where} » — vérifiez les convocations.`);
    }
    seenPlayerIds.set(playerId, where);
  }

  const orderedTeams = sortPosterTeams(input.teams);

  const teamColumns: ConvocationPosterTeamColumn[] = orderedTeams.map((team) => {
    const match = input.matchesByTeamId.get(team.teamId);
    if (!match) return { code: team.code, category: team.category, match: null };

    for (const p of match.players) claim(p.playerId, team.code);

    if (!match.opponent) anomalies.push(`${team.code} : adversaire non renseigné.`);
    if (!match.time) anomalies.push(`${team.code} : heure du match non renseignée.`);

    const levelLabel = team.level ? `${team.category} ${team.level}` : TODO;
    const players = [...match.players]
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
      .map((p, i) => ({ number: i + 1, name: playerName(p) }));

    return {
      code: team.code,
      category: team.category,
      match: {
        dateLabel: formatDateFull(match.date),
        level: levelLabel,
        competition: match.competition,
        opponent: match.opponent ?? TODO,
        location: match.location ?? TODO,
        surface: match.surface ?? TODO,
        venueAddress: match.venueAddress ?? TODO,
        time: match.time ?? TODO,
        meetTime: match.meetTime ?? TODO,
        meetLocation: match.meetLocation ?? TODO,
        estimatedEndTime: match.estimatedEndTime ?? TODO,
        estimatedReturnTime: match.estimatedReturnTime ?? TODO,
        parentNotes: match.parentNotes ?? "—",
        transportLabel: match.transportMode ? (TRANSPORT_MODE_LABELS[match.transportMode] ?? match.transportMode) : TODO,
        players,
        educateurs: match.educateurs.length > 0 ? match.educateurs.join(" / ") : TODO,
        phone: match.phone ?? TODO,
        dirigeants: match.dirigeants.length > 0 ? match.dirigeants.join(" / ") : TODO,
        jersey: match.jerseyHolder ? `${match.jerseyHolder.name} — retour prévu le ${formatDueDate(match.jerseyHolder.dueDate)}` : "—",
      },
    };
  });

  for (const p of input.sideLists.blesses) claim(p.playerId, "Blessés");
  for (const p of input.sideLists.absents) claim(p.playerId, "Absents");
  for (const p of input.sideLists.nonConvoques) claim(p.playerId, "Non convoqués");

  const shortName = input.clubShortName?.trim() || "SSFC";
  return {
    title: `CONVOCATIONS U12/U13 ${shortName} — SAISON ${input.seasonLabel}`,
    clubName: input.clubName,
    clubLogoUrl: input.clubLogoUrl,
    teams: teamColumns,
    sideColumn: {
      absents: input.sideLists.absents.map(playerName).sort((a, b) => a.localeCompare(b)),
      nonConvoques: input.sideLists.nonConvoques.map(playerName).sort((a, b) => a.localeCompare(b)),
      blesses: input.sideLists.blesses.map(playerName).sort((a, b) => a.localeCompare(b)),
    },
    anomalies,
  };
}
