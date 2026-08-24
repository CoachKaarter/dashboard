import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDistribution } from "./player-history";

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
