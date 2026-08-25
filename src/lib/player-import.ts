import type { XlsxCell } from "@/lib/match-import";
import { POSITIONS } from "@/lib/constants";

function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function cellToString(v: XlsxCell): string | null {
  if (v === null) return null;
  const s = typeof v === "number" ? String(v) : v.trim();
  return s.length ? s : null;
}

function cellToInt(v: XlsxCell): number | null {
  if (v === null) return null;
  const n = typeof v === "number" ? v : parseInt(v.trim(), 10);
  return Number.isFinite(n) && n > 1900 && n < 2100 ? n : null;
}

export function findPlayerColumns(
  header: XlsxCell[]
): { lastName: number; firstName: number; team: number; birthYear: number; position: number } | null {
  const norm = header.map((h) => normalizeHeader(String(h ?? "")));
  const find = (pred: (h: string) => boolean) => norm.findIndex(pred);
  const lastName = find((h) => h === "nom");
  const firstName = find((h) => h === "prenom" || h === "prénom");
  const team = find((h) => h.includes("equipe"));
  const birthYear = find((h) => h.includes("annee") && h.includes("naissance"));
  const position = find((h) => h === "poste");
  if (lastName < 0 || firstName < 0) return null;
  return { lastName, firstName, team, birthYear, position };
}

export type RawPlayerImportRow = {
  lastName: string | null;
  firstName: string | null;
  teamCode: string | null;
  birthYear: number | null;
  position: string | null;
};

// Tolerant of column order and of Équipe/Année de naissance/Poste being
// absent entirely — only Nom + Prénom are required in the header.
export function extractPlayerRows(grid: XlsxCell[][]): RawPlayerImportRow[] {
  if (grid.length < 2) return [];
  const cols = findPlayerColumns(grid[0]);
  if (!cols) return [];
  const rows: RawPlayerImportRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r || r.every((c) => c === null || c === "")) continue;
    rows.push({
      lastName: cellToString(r[cols.lastName] ?? null),
      firstName: cellToString(r[cols.firstName] ?? null),
      teamCode: cols.team >= 0 ? cellToString(r[cols.team] ?? null) : null,
      birthYear: cols.birthYear >= 0 ? cellToInt(r[cols.birthYear] ?? null) : null,
      position: cols.position >= 0 ? cellToString(r[cols.position] ?? null) : null,
    });
  }
  return rows;
}

// A category like "U12" turns into a plausible birth year when the file
// doesn't supply one — generalized from a category NUMBER rather than a
// hardcoded U12/U13 pair, so it stays correct for U8/U9 and beyond. French
// club seasons run August→July, so "the season currently in progress"
// starts this calendar year from July onward, last year before that.
export function guessBirthYearForCategory(category: string, today: Date = new Date()): number | null {
  const n = Number(category.replace(/[^0-9]/g, ""));
  if (!n) return null;
  const seasonStartYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
  return seasonStartYear - n + 1;
}

export type PlayerImportCandidate = {
  firstName: string;
  lastName: string;
  teamId: string;
  teamCode: string;
  birthYear: number;
  position: string;
};

export type PlayerImportOutcome =
  | { ok: true; sourceRow: number; candidate: PlayerImportCandidate; duplicate: boolean }
  | { ok: false; sourceRow: number; error: string };

export type ImportableTeam = { id: string; code: string; category: string; allowed: boolean };

// The team comes from the row's own "Équipe" column when the file has one;
// when it doesn't (or the cell is blank), every such row falls back to the
// team chosen once for the whole import — "équipe optionnelle" as long as
// a default is picked, mirroring buildMatchImportCandidates.
export function buildPlayerImportCandidates(
  rows: RawPlayerImportRow[],
  opts: { teams: ImportableTeam[]; fallbackTeamId: string | null; existingPlayerKeys: Set<string> }
): PlayerImportOutcome[] {
  const teamByCode = new Map(opts.teams.map((t) => [t.code.toUpperCase(), t]));
  const fallbackTeam = opts.teams.find((t) => t.id === opts.fallbackTeamId) ?? null;

  return rows.map((r, i) => {
    const sourceRow = i + 2;
    const lastName = r.lastName?.trim();
    const firstName = r.firstName?.trim();
    if (!lastName || !firstName) return { ok: false, sourceRow, error: "Nom ou prénom manquant" };

    const codeRaw = r.teamCode?.trim().toUpperCase() || null;
    let team: ImportableTeam | null;
    if (codeRaw) {
      const found = teamByCode.get(codeRaw);
      if (!found) return { ok: false, sourceRow, error: `Équipe "${codeRaw}" introuvable` };
      if (!found.allowed) return { ok: false, sourceRow, error: `Équipe "${codeRaw}" non autorisée pour votre compte` };
      team = found;
    } else {
      team = fallbackTeam;
    }
    if (!team) {
      return { ok: false, sourceRow, error: "Équipe manquante (pas de colonne « Équipe » et aucune équipe par défaut choisie)" };
    }

    const birthYear = r.birthYear ?? guessBirthYearForCategory(team.category) ?? new Date().getFullYear() - 10;
    const position = r.position && POSITIONS.includes(r.position) ? r.position : "Non renseigné";
    const key = `${team.id}|${lastName.toUpperCase()}|${firstName.toLowerCase()}`;

    return {
      ok: true,
      sourceRow,
      candidate: { firstName, lastName: lastName.toUpperCase(), teamId: team.id, teamCode: team.code, birthYear, position },
      duplicate: opts.existingPlayerKeys.has(key),
    };
  });
}
