import { test } from "node:test";
import assert from "node:assert/strict";
import { partitionCategoryRoster } from "./team-roster";

const TEAM_A = { id: "u12a", code: "U12A" };

test("partitionCategoryRoster: a player explicitly fixed on this team lands in fixed", () => {
  const players = [{ id: "p1", teamId: "u12a", matchTeamCodes: [] }];
  const result = partitionCategoryRoster(players, TEAM_A);
  assert.deepEqual(result.fixed.map((p) => p.id), ["p1"]);
  assert.deepEqual(result.calculated, []);
  assert.deepEqual(result.unassigned, []);
});

test("partitionCategoryRoster: a player fixed on a sibling team is excluded entirely", () => {
  const players = [{ id: "p1", teamId: "u12b", matchTeamCodes: ["U12A", "U12A"] }];
  const result = partitionCategoryRoster(players, TEAM_A);
  assert.deepEqual(result.fixed, []);
  assert.deepEqual(result.calculated, []);
  assert.deepEqual(result.unassigned, []);
});

test("partitionCategoryRoster: no fixed team, most matches played with this team -> calculated", () => {
  const players = [{ id: "p1", teamId: null, matchTeamCodes: ["U12A", "U12B", "U12A"] }];
  const result = partitionCategoryRoster(players, TEAM_A);
  assert.deepEqual(result.calculated.map((p) => p.id), ["p1"]);
  assert.deepEqual(result.fixed, []);
  assert.deepEqual(result.unassigned, []);
});

test("partitionCategoryRoster: no fixed team, most matches played with a sibling team -> excluded here", () => {
  const players = [{ id: "p1", teamId: null, matchTeamCodes: ["U12B", "U12B", "U12A"] }];
  const result = partitionCategoryRoster(players, TEAM_A);
  assert.deepEqual(result.calculated, []);
  assert.deepEqual(result.fixed, []);
  assert.deepEqual(result.unassigned, []);
});

test("partitionCategoryRoster: no fixed team, no match history at all -> unassigned", () => {
  const players = [{ id: "p1", teamId: null, matchTeamCodes: [] }];
  const result = partitionCategoryRoster(players, TEAM_A);
  assert.deepEqual(result.unassigned.map((p) => p.id), ["p1"]);
  assert.deepEqual(result.fixed, []);
  assert.deepEqual(result.calculated, []);
});

test("partitionCategoryRoster: a mixed category roster sorts correctly across buckets", () => {
  const players = [
    { id: "fixed-here", teamId: "u12a", matchTeamCodes: [] },
    { id: "fixed-elsewhere", teamId: "u12b", matchTeamCodes: [] },
    { id: "calc-here", teamId: null, matchTeamCodes: ["U12A"] },
    { id: "calc-elsewhere", teamId: null, matchTeamCodes: ["U12B"] },
    { id: "no-history", teamId: null, matchTeamCodes: [] },
  ];
  const result = partitionCategoryRoster(players, TEAM_A);
  assert.deepEqual(result.fixed.map((p) => p.id), ["fixed-here"]);
  assert.deepEqual(result.calculated.map((p) => p.id), ["calc-here"]);
  assert.deepEqual(result.unassigned.map((p) => p.id), ["no-history"]);
});
