import { test } from "node:test";
import assert from "node:assert/strict";
import { readXlsxFirstSheetGrid, findMatchColumns, extractMatchRows, buildMatchImportCandidates } from "./match-import";

// Builds a minimal, valid (STORED/uncompressed) .xlsx purely with Buffer
// operations — no system `zip` binary, no zlib — so the test is hermetic
// and exercises the real ZIP+XML parsing path in readXlsxFirstSheetGrid.
function buildStoredXlsx(files: { name: string; content: string }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8");
    const dataBuf = Buffer.from(f.content, "utf8");

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(dataBuf.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localParts.push(localHeader, nameBuf, dataBuf);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(dataBuf.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + dataBuf.length;
  }
  const centralStart = offset;
  const centralBuf = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(centralStart, 16);
  return Buffer.concat([...localParts, centralBuf, eocd]);
}

test("findMatchColumns: recognizes the club's header wording regardless of accents/case", () => {
  const cols = findMatchColumns(["ADVERSAIRE", "DATE DU MATCH(dd/mm/yyyy)", "HEURE DE DéBUT DU MATCH(hh:mm)", "HEURE DE FIN DU MATCH(hh:mm)", "Lieu de la rencontre"]);
  assert.deepEqual(cols, { team: -1, opponent: 0, date: 1, time: 2, location: 4 });
});

test("findMatchColumns: also recognizes an Equipe column when present", () => {
  const cols = findMatchColumns(["Equipe", "ADVERSAIRE", "DATE DU MATCH(dd/mm/yyyy)", "HEURE DE DéBUT DU MATCH(hh:mm)", "HEURE DE FIN DU MATCH(hh:mm)", "Lieu de la rencontre"]);
  assert.deepEqual(cols, { team: 0, opponent: 1, date: 2, time: 3, location: 5 });
});

test("findMatchColumns: returns null when Adversaire or Date is missing", () => {
  assert.equal(findMatchColumns(["Adversaire", "Heure", "Lieu"]), null);
  assert.equal(findMatchColumns(["Date", "Heure", "Lieu"]), null);
});

test("findMatchColumns: tolerates a reordered/reduced set of columns (time/location/team optional)", () => {
  const cols = findMatchColumns(["Lieu", "Adversaire", "Date"]);
  assert.deepEqual(cols, { team: -1, opponent: 1, date: 2, time: -1, location: 0 });
});

test("extractMatchRows: converts an Excel date serial and skips fully blank rows", () => {
  const grid = [
    ["ADVERSAIRE", "DATE DU MATCH(dd/mm/yyyy)", "HEURE DE DÉBUT DU MATCH(hh:mm)", "HEURE DE FIN DU MATCH(hh:mm)", "Lieu de la rencontre"],
    ["VOLTIGEURS DE CHATEAUBRIANT", 46260, "17:00", "18:20", "Rue des Plantes, 44230 Saint-Sébastien-sur-Loire"],
    [null, null, null, null, null],
    ["NANTES SC", 46263, null, null, null],
  ];
  const rows = extractMatchRows(grid);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].teamCode, null);
  assert.equal(rows[0].opponent, "VOLTIGEURS DE CHATEAUBRIANT");
  assert.equal(rows[0].date?.toISOString().slice(0, 10), "2026-08-26");
  assert.equal(rows[0].time, "17:00");
  assert.equal(rows[0].location, "Rue des Plantes, 44230 Saint-Sébastien-sur-Loire");
  assert.equal(rows[1].opponent, "NANTES SC");
  assert.equal(rows[1].date?.toISOString().slice(0, 10), "2026-08-29");
  assert.equal(rows[1].time, null);
  assert.equal(rows[1].location, null);
});

test("extractMatchRows: reads the per-row Equipe column when present", () => {
  const grid = [
    ["Equipe", "ADVERSAIRE", "DATE DU MATCH(dd/mm/yyyy)", "HEURE DE DéBUT DU MATCH(hh:mm)", "HEURE DE FIN DU MATCH(hh:mm)", "Lieu de la rencontre"],
    ["U12A", null, 46260, null, null, null],
    ["U12B", null, 46263, null, null, null],
  ];
  const rows = extractMatchRows(grid);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].teamCode, "U12A");
  assert.equal(rows[1].teamCode, "U12B");
});

test("extractMatchRows: returns nothing when the header doesn't match the expected template", () => {
  assert.deepEqual(extractMatchRows([["Nom", "Prénom"], ["Dupont", "Jean"]]), []);
});

const TEAMS = [
  { id: "team-u12a", code: "U12A", allowed: true },
  { id: "team-u12b", code: "U12B", allowed: true },
  { id: "team-u13c", code: "U13C", allowed: false },
];

test("buildMatchImportCandidates: flags a match with no readable date as an error, keeps the source row number", () => {
  const results = buildMatchImportCandidates(
    [
      { teamCode: "U12A", opponent: "AS Test", date: new Date(Date.UTC(2026, 7, 26)), time: "17:00", location: "Terrain A" },
      { teamCode: "U12A", opponent: "Club sans date", date: null, time: null, location: null },
    ],
    { defaultCompetition: "Championnat", defaultNeeded: 12, teams: TEAMS, fallbackTeamId: null }
  );
  assert.equal(results[0].ok, true);
  assert.equal(results[0].sourceRow, 2);
  assert.equal(results[1].ok, false);
  assert.equal(results[1].sourceRow, 3);
});

test("buildMatchImportCandidates: resolves the team from the row's Equipe column", () => {
  const [result] = buildMatchImportCandidates(
    [{ teamCode: "u12b", opponent: "AS Test", date: new Date(), time: null, location: null }],
    { defaultCompetition: "Championnat", defaultNeeded: 12, teams: TEAMS, fallbackTeamId: null }
  );
  assert.equal(result.ok && result.candidate.teamId, "team-u12b");
});

test("buildMatchImportCandidates: an unknown team code is rejected with a clear error", () => {
  const [result] = buildMatchImportCandidates(
    [{ teamCode: "U14Z", opponent: "AS Test", date: new Date(), time: null, location: null }],
    { defaultCompetition: "Championnat", defaultNeeded: 12, teams: TEAMS, fallbackTeamId: null }
  );
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : "", /introuvable/);
});

test("buildMatchImportCandidates: a team the user can't access is rejected even though it exists", () => {
  const [result] = buildMatchImportCandidates(
    [{ teamCode: "U13C", opponent: "AS Test", date: new Date(), time: null, location: null }],
    { defaultCompetition: "Championnat", defaultNeeded: 12, teams: TEAMS, fallbackTeamId: null }
  );
  assert.equal(result.ok, false);
  assert.match(!result.ok ? result.error : "", /autorisée/);
});

test("buildMatchImportCandidates: falls back to the chosen default team when the row has no Equipe value", () => {
  const [withFallback] = buildMatchImportCandidates(
    [{ teamCode: null, opponent: "AS Test", date: new Date(), time: null, location: null }],
    { defaultCompetition: "Championnat", defaultNeeded: 12, teams: TEAMS, fallbackTeamId: "team-u12a" }
  );
  assert.equal(withFallback.ok && withFallback.candidate.teamId, "team-u12a");
});

test("buildMatchImportCandidates: no Equipe value and no fallback team is rejected", () => {
  const [result] = buildMatchImportCandidates(
    [{ teamCode: null, opponent: "AS Test", date: new Date(), time: null, location: null }],
    { defaultCompetition: "Championnat", defaultNeeded: 12, teams: TEAMS, fallbackTeamId: null }
  );
  assert.equal(result.ok, false);
});

test("buildMatchImportCandidates: a filled location means home, a blank one means away", () => {
  const [withLocation, withoutLocation] = buildMatchImportCandidates(
    [
      { teamCode: "U12A", opponent: "Club A", date: new Date(), time: null, location: "Notre terrain" },
      { teamCode: "U12A", opponent: "Club B", date: new Date(), time: null, location: null },
    ],
    { defaultCompetition: "Championnat", defaultNeeded: 12, teams: TEAMS, fallbackTeamId: null }
  );
  assert.equal(withLocation.ok && withLocation.candidate.isHome, true);
  assert.equal(withoutLocation.ok && withoutLocation.candidate.isHome, false);
});

test("buildMatchImportCandidates: an opponent field naming a tournament forces competition Tournoi", () => {
  const [result] = buildMatchImportCandidates(
    [{ teamCode: "U12A", opponent: "TOURNOI USPF CUP", date: new Date(), time: "15:30", location: "Ailleurs" }],
    { defaultCompetition: "Championnat", defaultNeeded: 12, teams: TEAMS, fallbackTeamId: null }
  );
  assert.equal(result.ok && result.candidate.competition, "Tournoi");
  assert.equal(result.ok && result.candidate.opponent, "TOURNOI USPF CUP");
});

test("buildMatchImportCandidates: a normal opponent keeps the chosen default competition", () => {
  const [result] = buildMatchImportCandidates(
    [{ teamCode: "U12A", opponent: "AS Test", date: new Date(), time: null, location: null }],
    { defaultCompetition: "Amical", defaultNeeded: 14, teams: TEAMS, fallbackTeamId: null }
  );
  assert.equal(result.ok && result.candidate.competition, "Amical");
  assert.equal(result.ok && result.candidate.needed, 14);
});

test("readXlsxFirstSheetGrid: reads a real minimal .xlsx built purely from Buffers (ZIP+XML parsing)", () => {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="DYF" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`;
  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2"><si><t>ADVERSAIRE</t></si><si><t>ÉTOILE SPORTIVE</t></si></sst>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>46260</v></c></row></sheetData></worksheet>`;

  const buffer = buildStoredXlsx([
    { name: "[Content_Types].xml", content: contentTypes },
    { name: "_rels/.rels", content: rootRels },
    { name: "xl/workbook.xml", content: workbook },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRels },
    { name: "xl/sharedStrings.xml", content: sharedStrings },
    { name: "xl/worksheets/sheet1.xml", content: sheet },
  ]);

  const grid = readXlsxFirstSheetGrid(buffer);
  assert.deepEqual(grid[0], ["ADVERSAIRE"]);
  assert.deepEqual(grid[1], ["ÉTOILE SPORTIVE", 46260]);
});
