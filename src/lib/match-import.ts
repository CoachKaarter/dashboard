import zlib from "node:zlib";

// Minimal, dependency-free .xlsx reader scoped to exactly what the match
// import needs: the first sheet's flat grid of cell values. We deliberately
// don't pull in the "xlsx" npm package — its published build has known
// unpatched prototype-pollution/ReDoS advisories (GHSA-4r6h-8v6p-xvw6,
// GHSA-5pgg-2g8v-p4x9), and a full-featured parser (styles, formulas,
// merged cells...) is overkill for reading a handful of flat rows.

type ZipEntry = { offset: number; compressedSize: number; method: number };

function findEndOfCentralDirectory(buf: Buffer): number {
  const sig = 0x06054b50;
  const minPos = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (buf.readUInt32LE(i) === sig) return i;
  }
  throw new Error("Fichier ZIP invalide (fin de répertoire central introuvable).");
}

function listZipEntries(buf: Buffer): Map<string, ZipEntry> {
  const eocd = findEndOfCentralDirectory(buf);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const totalEntries = buf.readUInt16LE(eocd + 10);
  const entries = new Map<string, ZipEntry>();
  let p = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localHeaderOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    entries.set(name, { offset: localHeaderOffset, compressedSize, method });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function readZipEntry(buf: Buffer, entry: ZipEntry): Buffer {
  const nameLen = buf.readUInt16LE(entry.offset + 26);
  const extraLen = buf.readUInt16LE(entry.offset + 28);
  const dataStart = entry.offset + 30 + nameLen + extraLen;
  const compressed = buf.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(compressed);
  if (entry.method === 8) return zlib.inflateRawSync(compressed);
  throw new Error(`Méthode de compression ZIP non supportée (${entry.method}).`);
}

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml: string): string[] {
  const items: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const inner = m[1] ?? "";
    const texts = [...inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g)].map((tm) => unescapeXml(tm[1] ?? ""));
    items.push(texts.join(""));
  }
  return items;
}

function colLetterToIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export type XlsxCell = string | number | null;

function parseSheetGrid(xml: string, sharedStrings: string[]): XlsxCell[][] {
  const rowMap = new Map<number, XlsxCell[]>();
  let maxRow = 0;
  const rowRe = /<row\b[^>]*?r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const rowNum = parseInt(rm[1], 10);
    maxRow = Math.max(maxRow, rowNum);
    const inner = rm[2] ?? "";
    const rowArr: XlsxCell[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(inner))) {
      const attrs = cm[1] ?? "";
      const cellInner = cm[2] ?? "";
      const refMatch = attrs.match(/r="([A-Z]+)\d+"/);
      if (!refMatch) continue;
      const colIdx = colLetterToIndex(refMatch[1]);
      const typeMatch = attrs.match(/t="([^"]+)"/);
      const type = typeMatch ? typeMatch[1] : "n";
      const vMatch = cellInner.match(/<v>([\s\S]*?)<\/v>/);
      let value: XlsxCell = null;
      if (type === "s") {
        value = vMatch ? (sharedStrings[parseInt(vMatch[1], 10)] ?? "") : null;
      } else if (type === "inlineStr") {
        const tMatch = cellInner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        value = tMatch ? unescapeXml(tMatch[1]) : "";
      } else if (type === "str") {
        value = vMatch ? unescapeXml(vMatch[1]) : "";
      } else if (type === "b") {
        value = vMatch ? (vMatch[1] === "1" ? 1 : 0) : null;
      } else {
        value = vMatch ? parseFloat(vMatch[1]) : null;
      }
      rowArr[colIdx] = value;
    }
    rowMap.set(rowNum, rowArr);
  }
  const grid: XlsxCell[][] = [];
  for (let i = 1; i <= maxRow; i++) {
    const r = rowMap.get(i) ?? [];
    const maxColInRow = r.length;
    const filled: XlsxCell[] = [];
    for (let c = 0; c < maxColInRow; c++) filled.push(r[c] === undefined ? null : r[c]);
    grid.push(filled);
  }
  return grid;
}

// Reads the FIRST sheet (in tab order) of an .xlsx file into a flat grid of
// cell values, one array per row. This app's federation-provided match
// calendars are always a single sheet per team.
export function readXlsxFirstSheetGrid(buffer: Buffer): XlsxCell[][] {
  const entries = listZipEntries(buffer);
  const decode = (name: string) => {
    const entry = entries.get(name);
    return entry ? readZipEntry(buffer, entry).toString("utf8") : null;
  };

  const workbookXml = decode("xl/workbook.xml");
  const relsXml = decode("xl/_rels/workbook.xml.rels");
  if (!workbookXml || !relsXml) throw new Error("Classeur Excel invalide ou corrompu.");

  const sheetTagMatch = workbookXml.match(/<sheet\b[^>]*\/?>/);
  const rid = sheetTagMatch?.[0].match(/r:id="([^"]+)"/)?.[1];
  if (!rid) throw new Error("Aucune feuille trouvée dans le classeur.");

  const relTags = relsXml.match(/<Relationship\b[^>]*\/>/g) ?? [];
  const relTag = relTags.find((t) => t.includes(`Id="${rid}"`));
  const target = relTag?.match(/Target="([^"]+)"/)?.[1];
  if (!target) throw new Error("Relation vers la feuille introuvable.");
  const sheetPath = target.startsWith("xl/") ? target : `xl/${target.replace(/^\.?\//, "")}`;

  const sheetXml = decode(sheetPath);
  if (!sheetXml) throw new Error("Feuille de calcul introuvable dans le fichier.");

  const sharedStringsXml = decode("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];

  return parseSheetGrid(sheetXml, sharedStrings);
}

// ---------- Row → match candidate mapping (pure, unit-testable) ----------

export type RawMatchImportRow = {
  teamCode: string | null;
  opponent: string | null;
  date: Date | null;
  time: string | null;
  location: string | null;
};

const EXCEL_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);

export function excelSerialToUtcDate(serial: number): Date {
  return new Date(EXCEL_EPOCH_UTC_MS + Math.floor(serial) * 86400000);
}

function normalizeHeader(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function findMatchColumns(
  header: XlsxCell[]
): { team: number; opponent: number; date: number; time: number; location: number } | null {
  const norm = header.map((h) => normalizeHeader(String(h ?? "")));
  const find = (pred: (h: string) => boolean) => norm.findIndex(pred);
  const team = find((h) => h.includes("equipe"));
  const opponent = find((h) => h.includes("adversaire"));
  const date = find((h) => h.includes("date"));
  const time = find((h) => h.includes("heure") && h.includes("debut"));
  const location = find((h) => h.includes("lieu"));
  if (opponent < 0 || date < 0) return null;
  return { team, opponent, date, time, location };
}

function cellToDate(v: XlsxCell): Date | null {
  if (v === null) return null;
  if (typeof v === "number") return excelSerialToUtcDate(v);
  const dmy = v.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
  const parsed = new Date(v.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cellToString(v: XlsxCell): string | null {
  if (v === null) return null;
  const s = typeof v === "number" ? String(v) : v.trim();
  return s.length ? s : null;
}

function cellToTime(v: XlsxCell): string | null {
  if (v === null) return null;
  if (typeof v === "number") {
    // fraction of a day (rare — this template stores time as text, but a
    // spreadsheet could still store a true Excel time serial)
    const totalMinutes = Math.round(v * 24 * 60) % 1440;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const s = v.trim();
  return s.length ? s : null;
}

// Turns the flat grid (header row + data rows) into raw per-match rows,
// tolerant of column order and of the "HEURE DE FIN"/"Lieu" columns being
// absent (only ADVERSAIRE + DATE are required).
export function extractMatchRows(grid: XlsxCell[][]): RawMatchImportRow[] {
  if (grid.length < 2) return [];
  const cols = findMatchColumns(grid[0]);
  if (!cols) return [];
  const rows: RawMatchImportRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r || r.every((c) => c === null || c === "")) continue;
    rows.push({
      teamCode: cols.team >= 0 ? cellToString(r[cols.team] ?? null) : null,
      opponent: cellToString(r[cols.opponent] ?? null),
      date: cellToDate(r[cols.date] ?? null),
      time: cols.time >= 0 ? cellToTime(r[cols.time] ?? null) : null,
      location: cols.location >= 0 ? cellToString(r[cols.location] ?? null) : null,
    });
  }
  return rows;
}

// ---------- Raw row → match creation candidate (pure, unit-testable) ----------

export type MatchImportCandidate = {
  teamId: string;
  opponent: string | null;
  competition: string;
  date: Date;
  time: string | null;
  isHome: boolean;
  location: string | null;
  needed: number;
};

export type MatchImportOutcome =
  | { ok: true; sourceRow: number; candidate: MatchImportCandidate }
  | { ok: false; sourceRow: number; error: string };

export type ImportableTeam = { id: string; code: string; allowed: boolean };

// Rows are matched against a real match calendar: a tournament block reads
// "TOURNOI ..." in the opponent column (this club's own federation exports
// label it that way — see the sample file), so it's flagged as competition
// "Tournoi" regardless of the import's chosen default. Home/away isn't a
// column in this format at all — a location is only ever filled in once a
// venue is confirmed, and for THIS club's own matches that's known from day
// one, while an away opponent's ground is often still "à définir" — so a
// blank location defaults to away (isHome: false) and a filled one to home;
// either can be corrected by hand afterward like any manually created match.
//
// The team comes from the row's own "Equipe" column when the file has one
// (the club's more recent export format — one calendar can cover several
// teams at once); when it doesn't, every row falls back to the team chosen
// once for the whole import.
export function buildMatchImportCandidates(
  rows: RawMatchImportRow[],
  opts: { defaultCompetition: string; defaultNeeded: number; teams: ImportableTeam[]; fallbackTeamId: string | null }
): MatchImportOutcome[] {
  const teamByCode = new Map(opts.teams.map((t) => [t.code.toUpperCase(), t]));
  return rows.map((r, i) => {
    const sourceRow = i + 2; // header is row 1
    if (!r.date) return { ok: false, sourceRow, error: "Date manquante ou illisible" };

    const codeRaw = r.teamCode?.trim().toUpperCase() || null;
    let teamId: string | null;
    if (codeRaw) {
      const team = teamByCode.get(codeRaw);
      if (!team) return { ok: false, sourceRow, error: `Équipe "${codeRaw}" introuvable` };
      if (!team.allowed) return { ok: false, sourceRow, error: `Équipe "${codeRaw}" non autorisée pour votre compte` };
      teamId = team.id;
    } else {
      teamId = opts.fallbackTeamId;
      if (!teamId) {
        return { ok: false, sourceRow, error: "Équipe manquante (pas de colonne « Equipe » et aucune équipe par défaut choisie)" };
      }
    }

    const opponent = r.opponent;
    const isTournoi = !!opponent && /tournoi/i.test(opponent);
    return {
      ok: true,
      sourceRow,
      candidate: {
        teamId,
        opponent,
        competition: isTournoi ? "Tournoi" : opts.defaultCompetition,
        date: r.date,
        time: r.time,
        isHome: !!r.location,
        location: r.location,
        needed: opts.defaultNeeded,
      },
    };
  });
}
