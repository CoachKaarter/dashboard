import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTeamStats, computeForm } from "./team-stats";

function m(scoreFor: number, scoreAgainst: number, date = new Date("2026-01-01")): { scoreFor: number; scoreAgainst: number; date: Date } {
  return { scoreFor, scoreAgainst, date };
}

test("computeTeamStats: aggregates wins/draws/losses/goals from raw scores", () => {
  const stats = computeTeamStats([m(3, 1), m(1, 1), m(0, 2)]);
  assert.equal(stats.played, 3);
  assert.equal(stats.wins, 1);
  assert.equal(stats.draws, 1);
  assert.equal(stats.losses, 1);
  assert.equal(stats.goalsFor, 4);
  assert.equal(stats.goalsAgainst, 4);
  assert.equal(stats.goalDiff, 0);
});

test("computeTeamStats: winPct and averages round sensibly, zero matches never divides by zero", () => {
  const empty = computeTeamStats([]);
  assert.equal(empty.played, 0);
  assert.equal(empty.winPct, 0);
  assert.equal(empty.avgGoalsFor, 0);

  const stats = computeTeamStats([m(2, 0), m(1, 0)]);
  assert.equal(stats.winPct, 100);
  assert.equal(stats.avgGoalsFor, 1.5);
  assert.equal(stats.avgGoalsAgainst, 0);
});

test("computeForm: orders chronologically and keeps only the last N", () => {
  const matches = [
    m(0, 1, new Date("2026-01-01")), // PERDU, dropped (only last 2 kept)
    m(1, 1, new Date("2026-01-08")), // NUL
    m(2, 0, new Date("2026-01-15")), // GAGNE
  ];
  assert.deepEqual(computeForm(matches, 2), ["NUL", "GAGNE"]);
});

test("computeForm: unsorted input is sorted before slicing", () => {
  const matches = [
    m(2, 0, new Date("2026-01-15")), // GAGNE, most recent
    m(0, 1, new Date("2026-01-01")), // PERDU, oldest
  ];
  assert.deepEqual(computeForm(matches, 1), ["GAGNE"]);
});
