import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findPlayerColumns,
  extractPlayerRows,
  guessBirthYearForCategory,
  buildPlayerImportCandidates,
  type ImportableTeam,
} from "./player-import";

test("findPlayerColumns: recognizes the club's export header wording regardless of accents/case", () => {
  const cols = findPlayerColumns(["Nom", "Prénom", "Équipe", "Catégorie", "Année de naissance", "Poste", "Pied fort"]);
  assert.deepEqual(cols, { lastName: 0, firstName: 1, team: 2, birthYear: 4, position: 5 });
});

test("findPlayerColumns: tolerant of column order, and Équipe/Année/Poste are optional", () => {
  const cols = findPlayerColumns(["Prenom", "NOM"]);
  assert.deepEqual(cols, { lastName: 1, firstName: 0, team: -1, birthYear: -1, position: -1 });
});

test("findPlayerColumns: returns null when Nom or Prénom is missing", () => {
  assert.equal(findPlayerColumns(["Prénom", "Équipe"]), null);
  assert.equal(findPlayerColumns(["Nom", "Équipe"]), null);
});

test("extractPlayerRows: reads rows and skips blank lines", () => {
  const grid = [
    ["Nom", "Prénom", "Équipe"],
    ["DUPONT", "Léo", "U12A"],
    ["", "", ""],
    ["MARTIN", "Zoé", ""],
  ];
  assert.deepEqual(extractPlayerRows(grid), [
    { lastName: "DUPONT", firstName: "Léo", teamCode: "U12A", birthYear: null, position: null },
    { lastName: "MARTIN", firstName: "Zoé", teamCode: null, birthYear: null, position: null },
  ]);
});

test("guessBirthYearForCategory: generalizes to any U-category, not just U12/U13", () => {
  // Mid-season reference date (well past August, so seasonStartYear === today's year).
  const ref = new Date("2026-08-25");
  assert.equal(guessBirthYearForCategory("U12", ref), 2015);
  assert.equal(guessBirthYearForCategory("U13", ref), 2014);
  assert.equal(guessBirthYearForCategory("U8", ref), 2019);
  assert.equal(guessBirthYearForCategory("U9", ref), 2018);
});

test("guessBirthYearForCategory: before August, the season is still the previous calendar year's", () => {
  const ref = new Date("2027-03-01");
  assert.equal(guessBirthYearForCategory("U8", ref), 2019);
});

test("guessBirthYearForCategory: an unparseable category returns null", () => {
  assert.equal(guessBirthYearForCategory("École de foot"), null);
});

const TEAMS: ImportableTeam[] = [
  { id: "u8a", code: "U8A", category: "U8", allowed: true },
  { id: "u9a", code: "U9A", category: "U9", allowed: true },
  { id: "u12a", code: "U12A", category: "U12", allowed: true },
  { id: "u13a", code: "U13A", category: "U13", allowed: false },
];

test("buildPlayerImportCandidates: a row with its own Équipe column resolves that exact team", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: "U8A", birthYear: null, position: null }],
    { teams: TEAMS, fallbackTeamId: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) assert.equal(outcomes[0].candidate.teamId, "u8a");
});

test("buildPlayerImportCandidates: no Équipe column falls back to the chosen default team", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: null, birthYear: null, position: null }],
    { teams: TEAMS, fallbackTeamId: "u9a", existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) assert.equal(outcomes[0].candidate.teamId, "u9a");
});

test("buildPlayerImportCandidates: no Équipe column and no fallback team is an error, not a silent default", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: null, birthYear: null, position: null }],
    { teams: TEAMS, fallbackTeamId: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, false);
});

test("buildPlayerImportCandidates: a team the user isn't authorized for is rejected even if it exists", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: "U13A", birthYear: null, position: null }],
    { teams: TEAMS, fallbackTeamId: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, false);
  if (!outcomes[0].ok) assert.match(outcomes[0].error, /non autorisée/);
});

test("buildPlayerImportCandidates: missing name is rejected", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "", firstName: "Léo", teamCode: "U8A", birthYear: null, position: null }],
    { teams: TEAMS, fallbackTeamId: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, false);
});

test("buildPlayerImportCandidates: flags a row matching an existing player in the same team as a duplicate, but still returns a valid candidate", () => {
  const existingPlayerKeys = new Set(["u8a|DUPONT|léo"]);
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: "U8A", birthYear: null, position: null }],
    { teams: TEAMS, fallbackTeamId: null, existingPlayerKeys }
  );
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) assert.equal(outcomes[0].duplicate, true);
});

test("buildPlayerImportCandidates: the same name in a different team is not flagged as a duplicate", () => {
  const existingPlayerKeys = new Set(["u9a|DUPONT|léo"]);
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: "U8A", birthYear: null, position: null }],
    { teams: TEAMS, fallbackTeamId: null, existingPlayerKeys }
  );
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) assert.equal(outcomes[0].duplicate, false);
});

test("buildPlayerImportCandidates: an explicit birth year column wins over the category guess", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: "U8A", birthYear: 2017, position: null }],
    { teams: TEAMS, fallbackTeamId: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) assert.equal(outcomes[0].candidate.birthYear, 2017);
});
