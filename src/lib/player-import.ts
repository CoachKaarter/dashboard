import type { XlsxCell } from "@/lib/match-import";
import { excelSerialToUtcDate } from "@/lib/match-import";
import { POSITIONS } from "@/lib/constants";

function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Strips a trailing "(Obligatoire)"-style qualifier some club export tools
// add to header cells — without this, "Nom(Obligatoire)" never matches the
// bare "nom" a plain export would use, and "Parent 1 Nom(Obligatoire)" must
// still NOT match it either (kept distinct on purpose, see findPlayerColumns).
function stripParens(s: string): string {
  return s
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellToString(v: XlsxCell): string | null {
  if (v === null) return null;
  const s = typeof v === "number" ? String(v) : v.trim();
  return s.length ? s : null;
}

// French mobile/landline numbers that Excel stored as a plain number (no
// leading zero, since "0…" isn't a valid number literal) come back missing
// their leading 0 — restore it rather than shipping a broken phone number.
function cellToPhone(v: XlsxCell): string | null {
  const s = cellToString(v);
  if (!s) return null;
  return /^[1-9]\d{8}$/.test(s) ? `0${s}` : s;
}

// Handles both a plain year ("Année de naissance" template, already
// 1900-2100) and a full date of birth ("Date de naissance" template),
// itself either an Excel serial number or a dd/mm/yyyy or ISO string.
function cellToBirthYear(v: XlsxCell): number | null {
  if (v === null) return null;
  if (typeof v === "number") {
    if (v > 1900 && v < 2100) return Math.trunc(v);
    const year = excelSerialToUtcDate(v).getUTCFullYear();
    return year > 1900 && year < 2100 ? year : null;
  }
  const s = v.trim();
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return Number(dmy[3]);
  const iso = s.match(/^(\d{4})-\d{2}-\d{2}/);
  if (iso) return Number(iso[1]);
  const yearOnly = s.match(/^(\d{4})$/);
  return yearOnly ? Number(yearOnly[1]) : null;
}

export function findPlayerColumns(header: XlsxCell[]): {
  lastName: number;
  firstName: number;
  team: number;
  category: number;
  birthYear: number;
  position: number;
  parentFirstName: number;
  parentLastName: number;
  parentEmail: number;
  parentPhone: number;
  mainPhone: number;
} | null {
  const norm = header.map((h) => normalizeHeader(String(h ?? "")));
  const stripped = norm.map(stripParens);
  const find = (pred: (h: string, s: string) => boolean) => norm.findIndex((h, i) => pred(h, stripped[i]));
  const lastName = find((_h, s) => s === "nom");
  const firstName = find((_h, s) => s === "prenom");
  const team = find((h) => h.includes("equipe"));
  const category = find((_h, s) => s === "categorie");
  const birthYear = find((h) => (h.includes("annee") && h.includes("naissance")) || (h.includes("date") && h.includes("naissance")));
  const position = find((_h, s) => s === "poste");
  const parentFirstName = find((_h, s) => s === "parent 1 prenom");
  const parentLastName = find((_h, s) => s === "parent 1 nom");
  const parentEmail = find((_h, s) => s === "parent 1 email");
  const parentPhone = find((_h, s) => s === "parent 1 numero de telephone");
  const mainPhone = find((_h, s) => s === "numero de telephone");
  if (lastName < 0 || firstName < 0) return null;
  return { lastName, firstName, team, category, birthYear, position, parentFirstName, parentLastName, parentEmail, parentPhone, mainPhone };
}

export type RawPlayerImportRow = {
  lastName: string | null;
  firstName: string | null;
  teamCode: string | null;
  category?: string | null;
  birthYear: number | null;
  position: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
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
    const parentFirstName = cols.parentFirstName >= 0 ? cellToString(r[cols.parentFirstName] ?? null) : null;
    const parentLastName = cols.parentLastName >= 0 ? cellToString(r[cols.parentLastName] ?? null) : null;
    const parentPhone =
      (cols.parentPhone >= 0 ? cellToPhone(r[cols.parentPhone] ?? null) : null) ??
      (cols.mainPhone >= 0 ? cellToPhone(r[cols.mainPhone] ?? null) : null);
    rows.push({
      lastName: cellToString(r[cols.lastName] ?? null),
      firstName: cellToString(r[cols.firstName] ?? null),
      teamCode: cols.team >= 0 ? cellToString(r[cols.team] ?? null) : null,
      category: cols.category >= 0 ? cellToString(r[cols.category] ?? null) : null,
      birthYear: cols.birthYear >= 0 ? cellToBirthYear(r[cols.birthYear] ?? null) : null,
      position: cols.position >= 0 ? cellToString(r[cols.position] ?? null) : null,
      parentName: [parentFirstName, parentLastName].filter(Boolean).join(" ") || null,
      parentEmail: cols.parentEmail >= 0 ? cellToString(r[cols.parentEmail] ?? null) : null,
      parentPhone,
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
  parentName: string | null;
  parentEmail: string | null;
  parentPhone: string | null;
};

export type PlayerImportOutcome =
  | { ok: true; sourceRow: number; candidate: PlayerImportCandidate; duplicate: boolean }
  | { ok: false; sourceRow: number; error: string };

export type ImportableTeam = { id: string; code: string; category: string; allowed: boolean };

// The team comes, in order of preference, from: (1) the row's own "Équipe"
// column when the file has one and the code matches exactly; (2) the row's
// "Catégorie" column, resolved to the single team in that category — an
// ambiguous category (several teams, e.g. U12A/U12B/U12C) falls through to
// the chosen default team only when that default is itself in the same
// category; (3) the default team chosen once for the whole import.
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
    const categoryRaw = r.category?.trim().toUpperCase() || null;
    let team: ImportableTeam | null;
    if (codeRaw) {
      const found = teamByCode.get(codeRaw);
      if (!found) return { ok: false, sourceRow, error: `Équipe "${codeRaw}" introuvable` };
      if (!found.allowed) return { ok: false, sourceRow, error: `Équipe "${codeRaw}" non autorisée pour votre compte` };
      team = found;
    } else if (categoryRaw) {
      const inCategory = opts.teams.filter((t) => t.category.toUpperCase() === categoryRaw);
      if (inCategory.length === 1) {
        team = inCategory[0];
      } else if (inCategory.length === 0) {
        return { ok: false, sourceRow, error: `Aucune équipe pour la catégorie "${categoryRaw}"` };
      } else if (fallbackTeam && fallbackTeam.category.toUpperCase() === categoryRaw) {
        team = fallbackTeam;
      } else {
        return {
          ok: false,
          sourceRow,
          error: `Plusieurs équipes existent pour la catégorie "${categoryRaw}" — choisissez une équipe par défaut de cette catégorie`,
        };
      }
      if (!team.allowed) return { ok: false, sourceRow, error: `Équipe "${team.code}" non autorisée pour votre compte` };
    } else {
      team = fallbackTeam;
    }
    if (!team) {
      return { ok: false, sourceRow, error: "Équipe manquante (pas de colonne « Équipe »/« Catégorie » et aucune équipe par défaut choisie)" };
    }

    const birthYear = r.birthYear ?? guessBirthYearForCategory(team.category) ?? new Date().getFullYear() - 10;
    const position = r.position && POSITIONS.includes(r.position) ? r.position : "Non renseigné";
    const key = `${team.id}|${lastName.toUpperCase()}|${firstName.toLowerCase()}`;

    return {
      ok: true,
      sourceRow,
      candidate: {
        firstName,
        lastName: lastName.toUpperCase(),
        teamId: team.id,
        teamCode: team.code,
        birthYear,
        position,
        parentName: r.parentName?.trim() || null,
        parentEmail: r.parentEmail?.trim() || null,
        parentPhone: r.parentPhone?.trim() || null,
      },
      duplicate: opts.existingPlayerKeys.has(key),
    };
  });
}
