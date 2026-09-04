import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findPlayerColumns,
  extractPlayerRows,
  guessBirthYearForCategory,
  buildPlayerImportCandidates,
  type ImportableTeam,
  type ImportableCategory,
} from "./player-import";

const NO_COLS = { parentFirstName: -1, parentLastName: -1, parentEmail: -1, parentPhone: -1, mainPhone: -1 };

test("findPlayerColumns: recognizes the club's export header wording regardless of accents/case", () => {
  const cols = findPlayerColumns(["Nom", "Prénom", "Équipe", "Catégorie", "Année de naissance", "Poste", "Pied fort"]);
  assert.deepEqual(cols, { lastName: 0, firstName: 1, team: 2, category: 3, birthYear: 4, position: 5, ...NO_COLS });
});

test("findPlayerColumns: tolerant of column order, and Équipe/Année/Poste are optional", () => {
  const cols = findPlayerColumns(["Prenom", "NOM"]);
  assert.deepEqual(cols, { lastName: 1, firstName: 0, team: -1, category: -1, birthYear: -1, position: -1, ...NO_COLS });
});

test("findPlayerColumns: returns null when Nom or Prénom is missing", () => {
  assert.equal(findPlayerColumns(["Prénom", "Équipe"]), null);
  assert.equal(findPlayerColumns(["Nom", "Équipe"]), null);
});

// Real header wording from the club's own fill-in template: "(Obligatoire)"
// suffixes, a "Catégorie" column instead of "Équipe", "Date de naissance"
// instead of "Année de naissance", and Parent 1/Parent 2 contact columns —
// "Parent 1 Nom(Obligatoire)" must resolve to a parent column, never to the
// player's own "Nom(Obligatoire)".
test("findPlayerColumns: recognizes the club template's wording (Obligatoire suffixes, Date de naissance, Parent 1)", () => {
  const cols = findPlayerColumns([
    "Catégorie",
    "Prénom(Obligatoire)",
    "Nom(Obligatoire)",
    "Date de naissance",
    "Poste",
    "Numéro de téléphone (Obligatoire)",
    "Parent 1 Prénom(Obligatoire)",
    "Parent 1 Nom(Obligatoire) ",
    "Parent 1 Email(Obligatoire) ",
    "Parent 1 Numéro de téléphone(Obligatoire) ",
    "Parent 2 Prénom",
    "Parent 2 Nom",
    "Parent 2 Email",
    "Parent 2 Numéro de téléphone",
  ]);
  assert.deepEqual(cols, {
    lastName: 2,
    firstName: 1,
    team: -1,
    category: 0,
    birthYear: 3,
    position: 4,
    mainPhone: 5,
    parentFirstName: 6,
    parentLastName: 7,
    parentEmail: 8,
    parentPhone: 9,
  });
});

test("extractPlayerRows: reads rows and skips blank lines", () => {
  const grid = [
    ["Nom", "Prénom", "Équipe"],
    ["DUPONT", "Léo", "U12A"],
    ["", "", ""],
    ["MARTIN", "Zoé", ""],
  ];
  assert.deepEqual(extractPlayerRows(grid), [
    { lastName: "DUPONT", firstName: "Léo", teamCode: "U12A", category: null, birthYear: null, position: null, parentName: null, parentEmail: null, parentPhone: null },
    { lastName: "MARTIN", firstName: "Zoé", teamCode: null, category: null, birthYear: null, position: null, parentName: null, parentEmail: null, parentPhone: null },
  ]);
});

test("extractPlayerRows: club template — Date de naissance (Excel serial), Catégorie, Parent 1 contact, phone missing its leading 0", () => {
  const grid = [
    [
      "Catégorie",
      "Prénom(Obligatoire)",
      "Nom(Obligatoire)",
      "Date de naissance",
      "Poste",
      "Numéro de téléphone (Obligatoire)",
      "Parent 1 Prénom(Obligatoire)",
      "Parent 1 Nom(Obligatoire) ",
      "Parent 1 Email(Obligatoire) ",
      "Parent 1 Numéro de téléphone(Obligatoire) ",
    ],
    // 2019-02-05 as an Excel serial (days since 1899-12-30).
    ["U8", "Aerik", "AGBOKANZO", 43501, null, 618323253, "Selom", "AGBOKANZO", "selomagbokanzo@gmail.com", 618323253],
  ];
  const rows = extractPlayerRows(grid);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    lastName: "AGBOKANZO",
    firstName: "Aerik",
    teamCode: null,
    category: "U8",
    birthYear: 2019,
    position: null,
    parentName: "Selom AGBOKANZO",
    parentEmail: "selomagbokanzo@gmail.com",
    parentPhone: "0618323253",
  });
});

test("extractPlayerRows: falls back to the top-level phone column when Parent 1's own phone is blank", () => {
  const grid = [
    ["Nom(Obligatoire)", "Prénom(Obligatoire)", "Numéro de téléphone (Obligatoire)", "Parent 1 Numéro de téléphone(Obligatoire)"],
    ["Martin", "Zoé", "0623598071", null],
  ];
  assert.equal(extractPlayerRows(grid)[0].parentPhone, "0623598071");
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
const CATEGORIES: ImportableCategory[] = [
  { code: "U8", allowed: true },
  { code: "U9", allowed: true },
  { code: "U12", allowed: true },
  { code: "U13", allowed: false },
];

test("buildPlayerImportCandidates: a row with its own Équipe column resolves that exact team", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: "U8A", birthYear: null, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) {
    assert.equal(outcomes[0].candidate.teamId, "u8a");
    assert.equal(outcomes[0].candidate.category, "U8");
  }
});

// The normal path now: a player is never pinned to a specific team by
// import, only to a category — teamId stays null.
test("buildPlayerImportCandidates: a Catégorie column with no Équipe column resolves the category, no team", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: null, category: "U8", birthYear: null, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) {
    assert.equal(outcomes[0].candidate.teamId, null);
    assert.equal(outcomes[0].candidate.teamCode, null);
    assert.equal(outcomes[0].candidate.category, "U8");
  }
});

test("buildPlayerImportCandidates: no Catégorie column falls back to the chosen default category", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: null, category: null, birthYear: null, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: "U9", existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) {
    assert.equal(outcomes[0].candidate.teamId, null);
    assert.equal(outcomes[0].candidate.category, "U9");
  }
});

test("buildPlayerImportCandidates: no Catégorie column and no fallback category is an error, not a silent default", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: null, category: null, birthYear: null, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, false);
});

test("buildPlayerImportCandidates: a team the user isn't authorized for is rejected even if it exists", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: "U13A", birthYear: null, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, false);
  if (!outcomes[0].ok) assert.match(outcomes[0].error, /non autorisée/);
});

test("buildPlayerImportCandidates: a category the user isn't authorized for is rejected even if it exists", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: null, category: "U13", birthYear: null, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, false);
  if (!outcomes[0].ok) assert.match(outcomes[0].error, /non autorisée/);
});

test("buildPlayerImportCandidates: an unknown category is rejected", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: null, category: "U10", birthYear: null, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, false);
  if (!outcomes[0].ok) assert.match(outcomes[0].error, /introuvable/);
});

test("buildPlayerImportCandidates: missing name is rejected", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "", firstName: "Léo", teamCode: "U8A", birthYear: null, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, false);
});

test("buildPlayerImportCandidates: flags a row matching an existing player in the same category as a duplicate, but still returns a valid candidate", () => {
  const existingPlayerKeys = new Set(["U8|DUPONT|léo"]);
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: "U8A", birthYear: null, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys }
  );
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) assert.equal(outcomes[0].duplicate, true);
});

test("buildPlayerImportCandidates: the same name in a different category is not flagged as a duplicate", () => {
  const existingPlayerKeys = new Set(["U9|DUPONT|léo"]);
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: "U8A", birthYear: null, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys }
  );
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) assert.equal(outcomes[0].duplicate, false);
});

test("buildPlayerImportCandidates: an explicit birth year column wins over the category guess", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: "U8A", birthYear: 2017, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) assert.equal(outcomes[0].candidate.birthYear, 2017);
});

test("buildPlayerImportCandidates: an explicit Équipe column wins over Catégorie when both are present", () => {
  const outcomes = buildPlayerImportCandidates(
    [{ lastName: "Dupont", firstName: "Léo", teamCode: "U9A", category: "U8", birthYear: null, position: null }],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) {
    assert.equal(outcomes[0].candidate.teamId, "u9a");
    assert.equal(outcomes[0].candidate.category, "U9");
  }
});

test("buildPlayerImportCandidates: carries parent contact info through to the candidate", () => {
  const outcomes = buildPlayerImportCandidates(
    [
      {
        lastName: "Dupont",
        firstName: "Léo",
        teamCode: "U8A",
        birthYear: null,
        position: null,
        parentName: "Selom AGBOKANZO",
        parentEmail: "selom@example.com",
        parentPhone: "0618323253",
      },
    ],
    { teams: TEAMS, categories: CATEGORIES, fallbackCategory: null, existingPlayerKeys: new Set() }
  );
  assert.equal(outcomes[0].ok, true);
  if (outcomes[0].ok) {
    assert.equal(outcomes[0].candidate.parentName, "Selom AGBOKANZO");
    assert.equal(outcomes[0].candidate.parentEmail, "selom@example.com");
    assert.equal(outcomes[0].candidate.parentPhone, "0618323253");
  }
});
