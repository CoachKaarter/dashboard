import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEvaluationDelta } from "./evaluation";

// Cases 15/16 — a dimension's delta compares that SAME dimension across
// periods, never against the previous period's overall average.
test("computeEvaluationDelta: technique compares technique vs technique, not vs the previous overall average", () => {
  // Previous period: technique 2, tactique 5, physique 5, comportement 5 -> moyenne 4.25
  const previous = { technique: 2, tactique: 5, physique: 5, comportement: 5 };
  const current = { technique: 3, tactique: 5, physique: 5, comportement: 5 };
  // Correct: 3 - 2 = +1. The old (buggy) code would have given 3 - 4.25 = -1.25.
  assert.equal(computeEvaluationDelta(current, previous, "technique"), 1);
});

test("computeEvaluationDelta: tactique compares tactique vs tactique, not vs the previous overall average", () => {
  const previous = { technique: 5, tactique: 2, physique: 5, comportement: 5 };
  const current = { technique: 5, tactique: 4, physique: 5, comportement: 5 };
  assert.equal(computeEvaluationDelta(current, previous, "tactique"), 2);
});

test("computeEvaluationDelta: with no previous period, delta is zero", () => {
  const current = { technique: 3, tactique: 4, physique: 5, comportement: 2 };
  assert.equal(computeEvaluationDelta(current, null, "physique"), 0);
});

test("computeEvaluationDelta: a drop in one dimension while others rise is still reported correctly", () => {
  const previous = { technique: 4, tactique: 2, physique: 3, comportement: 3 };
  const current = { technique: 3, tactique: 5, physique: 3, comportement: 3 };
  assert.equal(computeEvaluationDelta(current, previous, "technique"), -1);
  assert.equal(computeEvaluationDelta(current, previous, "comportement"), 0);
});
