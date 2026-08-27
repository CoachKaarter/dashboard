import { test } from "node:test";
import assert from "node:assert/strict";
import { buildConvocationPosterData, sortPosterTeams, fallbackSeasonLabel, type ConvocationPosterInput } from "./convocation-poster";

test("fallbackSeasonLabel: juillet démarre la nouvelle saison, juin la termine", () => {
  assert.equal(fallbackSeasonLabel(new Date("2026-08-27")), "2026/2027");
  assert.equal(fallbackSeasonLabel(new Date("2027-07-01")), "2027/2028");
  assert.equal(fallbackSeasonLabel(new Date("2027-06-30")), "2026/2027");
  assert.equal(fallbackSeasonLabel(new Date("2027-01-15")), "2026/2027");
});

function baseInput(overrides: Partial<ConvocationPosterInput> = {}): ConvocationPosterInput {
  return {
    clubName: "Saint-Sébastien FC",
    clubShortName: "SSFC",
    seasonLabel: "2026/2027",
    clubLogoUrl: null,
    teams: [
      { teamId: "t-u12a", code: "U12A", category: "U12", level: "ELITE" },
      { teamId: "t-u13a", code: "U13A", category: "U13", level: "D1" },
    ],
    matchesByTeamId: new Map(),
    sideLists: { blesses: [], absents: [], nonConvoques: [] },
    ...overrides,
  };
}

test("title uses the given club short name and season — never a hardcoded one", () => {
  const data = buildConvocationPosterData(baseInput());
  assert.equal(data.title, "CONVOCATIONS U12/U13 SSFC — SAISON 2026/2027");

  const other = buildConvocationPosterData(baseInput({ clubShortName: "OL", seasonLabel: "2030/2031" }));
  assert.equal(other.title, "CONVOCATIONS U12/U13 OL — SAISON 2030/2031");
});

test("sortPosterTeams: U13 always before U12, alphabetical within a category, no assumption about exact codes", () => {
  const teams = [
    { code: "U12C", category: "U12" },
    { code: "U13B", category: "U13" },
    { code: "U12A", category: "U12" },
    { code: "U13A", category: "U13" },
  ];
  const sorted = sortPosterTeams(teams).map((t) => t.code);
  assert.deepEqual(sorted, ["U13A", "U13B", "U12A", "U12C"]);
});

test("a team with no match this weekend shows null (component renders 'Pas de match')", () => {
  const data = buildConvocationPosterData(baseInput());
  const u12a = data.teams.find((t) => t.code === "U12A");
  assert.equal(u12a?.match, null);
});

test("missing opponent or time on a real match raises an anomaly, but never crashes", () => {
  const data = buildConvocationPosterData(
    baseInput({
      matchesByTeamId: new Map([
        [
          "t-u13a",
          {
            matchId: "m1", teamId: "t-u13a", date: new Date("2026-08-29"), competition: "Championnat",
            opponent: null, isHome: true, location: "Stade A", surface: null, venueAddress: null,
            time: null, meetTime: null, meetLocation: null, estimatedEndTime: null, estimatedReturnTime: null,
            parentNotes: null, transportMode: null, players: [], educateurs: [], phone: null, dirigeants: [],
            jerseyHolder: null,
          },
        ],
      ]),
    })
  );
  assert.match(data.anomalies.join("\n"), /U13A : adversaire non renseigné/);
  assert.match(data.anomalies.join("\n"), /U13A : heure du match non renseignée/);
  const u13a = data.teams.find((t) => t.code === "U13A")!.match!;
  assert.equal(u13a.opponent, "À confirmer");
  assert.equal(u13a.time, "À confirmer");
  // Optional-only fields also fall back to "À confirmer" without becoming anomalies.
  assert.equal(u13a.venueAddress, "À confirmer");
  assert.equal(u13a.surface, "À confirmer");
});

test("no essential-field anomaly when opponent and time are both present", () => {
  const data = buildConvocationPosterData(
    baseInput({
      matchesByTeamId: new Map([
        [
          "t-u13a",
          {
            matchId: "m1", teamId: "t-u13a", date: new Date("2026-08-29"), competition: "Championnat",
            opponent: "AS Rivalité", isHome: true, location: "Stade A", surface: "Synthétique", venueAddress: "1 rue du stade",
            time: "10:30", meetTime: "09:45", meetLocation: "Parking club", estimatedEndTime: "11:30", estimatedReturnTime: "12:15",
            parentNotes: "Prévoir crampons", transportMode: "COVOITURAGE", players: [], educateurs: ["Marvyn"], phone: "0600000000",
            dirigeants: ["Davy"], jerseyHolder: null,
          },
        ],
      ]),
    })
  );
  assert.equal(data.anomalies.length, 0);
  const m = data.teams.find((t) => t.code === "U13A")!.match!;
  assert.equal(m.opponent, "AS Rivalité");
  assert.equal(m.level, "U13 D1");
});

test("team with no level configured falls back to 'À confirmer', never guesses another team's value", () => {
  const data = buildConvocationPosterData(
    baseInput({
      teams: [{ teamId: "t-u12c", code: "U12C", category: "U12", level: null }],
      matchesByTeamId: new Map([
        [
          "t-u12c",
          {
            matchId: "m2", teamId: "t-u12c", date: new Date("2026-08-29"), competition: "Championnat",
            opponent: "X", isHome: true, location: "Stade B", surface: null, venueAddress: null,
            time: "10:00", meetTime: null, meetLocation: null, estimatedEndTime: null, estimatedReturnTime: null,
            parentNotes: null, transportMode: null, players: [], educateurs: [], phone: null, dirigeants: [],
            jerseyHolder: null,
          },
        ],
      ]),
    })
  );
  assert.equal(data.teams[0].match!.level, "À confirmer");
});

test("convoked players are numbered from 1 and sorted alphabetically by last name", () => {
  const data = buildConvocationPosterData(
    baseInput({
      matchesByTeamId: new Map([
        [
          "t-u13a",
          {
            matchId: "m1", teamId: "t-u13a", date: new Date("2026-08-29"), competition: "Championnat",
            opponent: "X", isHome: true, location: "Stade A", surface: null, venueAddress: null,
            time: "10:00", meetTime: null, meetLocation: null, estimatedEndTime: null, estimatedReturnTime: null,
            parentNotes: null, transportMode: null,
            players: [
              { playerId: "p3", firstName: "Zoé", lastName: "Zidane" },
              { playerId: "p1", firstName: "Léo", lastName: "Dupont" },
              { playerId: "p2", firstName: "Kyllian", lastName: "Gabala" },
            ],
            educateurs: [], phone: null, dirigeants: [], jerseyHolder: null,
          },
        ],
      ]),
    })
  );
  const players = data.teams.find((t) => t.code === "U13A")!.match!.players;
  assert.deepEqual(
    players.map((p) => [p.number, p.name]),
    [
      [1, "Léo Dupont"],
      [2, "Kyllian Gabala"],
      [3, "Zoé Zidane"],
    ]
  );
});

test("a player convoked on two different teams raises an anomaly (should never happen but must be caught)", () => {
  const data = buildConvocationPosterData(
    baseInput({
      matchesByTeamId: new Map([
        [
          "t-u13a",
          {
            matchId: "m1", teamId: "t-u13a", date: new Date("2026-08-29"), competition: "Championnat",
            opponent: "X", isHome: true, location: "A", surface: null, venueAddress: null,
            time: "10:00", meetTime: null, meetLocation: null, estimatedEndTime: null, estimatedReturnTime: null,
            parentNotes: null, transportMode: null,
            players: [{ playerId: "p1", firstName: "Léo", lastName: "Dupont" }],
            educateurs: [], phone: null, dirigeants: [], jerseyHolder: null,
          },
        ],
        [
          "t-u12a",
          {
            matchId: "m2", teamId: "t-u12a", date: new Date("2026-08-29"), competition: "Championnat",
            opponent: "Y", isHome: true, location: "B", surface: null, venueAddress: null,
            time: "11:00", meetTime: null, meetLocation: null, estimatedEndTime: null, estimatedReturnTime: null,
            parentNotes: null, transportMode: null,
            players: [{ playerId: "p1", firstName: "Léo", lastName: "Dupont" }],
            educateurs: [], phone: null, dirigeants: [], jerseyHolder: null,
          },
        ],
      ]),
    })
  );
  assert.match(data.anomalies.join("\n"), /Léo|U13A.*U12A|U12A.*U13A/i);
  assert.ok(data.anomalies.some((a) => a.includes("U13A") && a.includes("U12A")));
});

test("a player who is both convoked and listed as blessé also raises an anomaly", () => {
  const data = buildConvocationPosterData(
    baseInput({
      matchesByTeamId: new Map([
        [
          "t-u13a",
          {
            matchId: "m1", teamId: "t-u13a", date: new Date("2026-08-29"), competition: "Championnat",
            opponent: "X", isHome: true, location: "A", surface: null, venueAddress: null,
            time: "10:00", meetTime: null, meetLocation: null, estimatedEndTime: null, estimatedReturnTime: null,
            parentNotes: null, transportMode: null,
            players: [{ playerId: "p1", firstName: "Léo", lastName: "Dupont" }],
            educateurs: [], phone: null, dirigeants: [], jerseyHolder: null,
          },
        ],
      ]),
      sideLists: { blesses: [{ playerId: "p1", firstName: "Léo", lastName: "Dupont" }], absents: [], nonConvoques: [] },
    })
  );
  assert.ok(data.anomalies.some((a) => a.includes("U13A") && a.includes("Blessés")));
});

test("jersey bag holder shows name and due date; no holder shows a dash, never 'À confirmer'", () => {
  const withHolder = buildConvocationPosterData(
    baseInput({
      matchesByTeamId: new Map([
        [
          "t-u13a",
          {
            matchId: "m1", teamId: "t-u13a", date: new Date("2026-08-29"), competition: "Championnat",
            opponent: "X", isHome: true, location: "A", surface: null, venueAddress: null,
            time: "10:00", meetTime: null, meetLocation: null, estimatedEndTime: null, estimatedReturnTime: null,
            parentNotes: null, transportMode: null, players: [], educateurs: [], phone: null, dirigeants: [],
            jerseyHolder: { name: "Famille Dupont", dueDate: new Date("2026-09-05") },
          },
        ],
      ]),
    })
  );
  const m = withHolder.teams.find((t) => t.code === "U13A")!.match!;
  assert.match(m.jersey, /Famille Dupont/);
  assert.match(m.jersey, /retour prévu le/);

  const withoutHolder = buildConvocationPosterData(
    baseInput({
      matchesByTeamId: new Map([
        [
          "t-u13a",
          {
            matchId: "m1", teamId: "t-u13a", date: new Date("2026-08-29"), competition: "Championnat",
            opponent: "X", isHome: true, location: "A", surface: null, venueAddress: null,
            time: "10:00", meetTime: null, meetLocation: null, estimatedEndTime: null, estimatedReturnTime: null,
            parentNotes: null, transportMode: null, players: [], educateurs: [], phone: null, dirigeants: [],
            jerseyHolder: null,
          },
        ],
      ]),
    })
  );
  assert.equal(withoutHolder.teams.find((t) => t.code === "U13A")!.match!.jersey, "—");
});

test("side column lists are alphabetically sorted and independent of each other", () => {
  const data = buildConvocationPosterData(
    baseInput({
      sideLists: {
        blesses: [{ playerId: "b1", firstName: "Zoé", lastName: "Zidane" }, { playerId: "b2", firstName: "Amir", lastName: "Ali" }],
        absents: [{ playerId: "a1", firstName: "Léo", lastName: "Dupont" }],
        nonConvoques: [],
      },
    })
  );
  assert.deepEqual(data.sideColumn.blesses, ["Amir Ali", "Zoé Zidane"]);
  assert.deepEqual(data.sideColumn.absents, ["Léo Dupont"]);
  assert.deepEqual(data.sideColumn.nonConvoques, []);
});
