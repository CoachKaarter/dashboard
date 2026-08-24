import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMatchPhase, computeMatchResult, computeGoalDifference } from "./match-phase";

test("computeMatchPhase: Annulé always wins regardless of other data", () => {
  assert.equal(
    computeMatchPhase({ status: "Annulé", convocationCount: 12, startersCount: 8, neededStarters: 8, bilanFilled: true }),
    "ANNULE"
  );
});

test("computeMatchPhase: Planifié -> Convoqué -> Prêt as convocations/composition fill in", () => {
  assert.equal(
    computeMatchPhase({ status: "Planifié", convocationCount: 0, startersCount: 0, neededStarters: 8, bilanFilled: false }),
    "PLANIFIE"
  );
  assert.equal(
    computeMatchPhase({ status: "Planifié", convocationCount: 10, startersCount: 5, neededStarters: 8, bilanFilled: false }),
    "CONVOQUE"
  );
  assert.equal(
    computeMatchPhase({ status: "Planifié", convocationCount: 10, startersCount: 8, neededStarters: 8, bilanFilled: false }),
    "PRET"
  );
});

test("computeMatchPhase: Joué -> Analysé once the bilan is filled", () => {
  assert.equal(
    computeMatchPhase({ status: "Joué", convocationCount: 12, startersCount: 8, neededStarters: 8, bilanFilled: false }),
    "JOUE"
  );
  assert.equal(
    computeMatchPhase({ status: "Joué", convocationCount: 12, startersCount: 8, neededStarters: 8, bilanFilled: true }),
    "ANALYSE"
  );
});

test("computeMatchResult: derives G/N/P from the score alone", () => {
  assert.equal(computeMatchResult(4, 2), "GAGNE");
  assert.equal(computeMatchResult(1, 1), "NUL");
  assert.equal(computeMatchResult(0, 2), "PERDU");
});

test("computeGoalDifference", () => {
  assert.equal(computeGoalDifference(4, 2), 2);
  assert.equal(computeGoalDifference(1, 1), 0);
  assert.equal(computeGoalDifference(0, 2), -2);
});
