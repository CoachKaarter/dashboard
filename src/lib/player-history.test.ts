import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDistribution, computeUsualTeamCode } from "./player-history";

test("computeDistribution: empty input returns an empty distribution", () => {
  assert.deepEqual(computeDistribution([]), []);
});

test("computeDistribution: counts and percentages, most frequent first", () => {
  const dist = computeDistribution(["U13A", "U13A", "U13B", "U13A", "U13B"]);
  assert.deepEqual(dist, [
    { value: "U13A", count: 3, pct: 60 },
    { value: "U13B", count: 2, pct: 40 },
  ]);
});

test("computeDistribution: a single recurring value is 100%", () => {
  assert.deepEqual(computeDistribution(["Attaquant", "Attaquant"]), [{ value: "Attaquant", count: 2, pct: 100 }]);
});

test("computeUsualTeamCode: no matches played returns null (à affecter case)", () => {
  assert.equal(computeUsualTeamCode([]), null);
});

test("computeUsualTeamCode: returns the team with the most matches played", () => {
  assert.equal(computeUsualTeamCode(["U12A", "U12B", "U12A", "U12A"]), "U12A");
});

test("computeUsualTeamCode: a single match already determines the usual team", () => {
  assert.equal(computeUsualTeamCode(["U13B"]), "U13B");
});
