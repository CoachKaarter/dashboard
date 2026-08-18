import { test } from "node:test";
import assert from "node:assert/strict";
import { convocationsToCreate } from "./weekend-convocations";

// Case 1 (§147) — PlayerAvailability AVAILABLE never triggers a
// convocation on its own; only a WeekendAssignment with a matchId does.
test("convocationsToCreate: an assignment without a matchId never produces a convocation", () => {
  const result = convocationsToCreate([{ playerId: "p1", matchId: null }], new Set());
  assert.deepEqual(result, []);
});

// Case 2 — a WeekendAssignment with a matchId produces the matching convocation.
test("convocationsToCreate: a real assignment produces its convocation", () => {
  const result = convocationsToCreate([{ playerId: "p1", matchId: "m1" }], new Set());
  assert.deepEqual(result, [{ matchId: "m1", playerId: "p1" }]);
});

// Case 3 — publishing twice must never create a duplicate.
test("convocationsToCreate: idempotent — already-existing convocations are skipped", () => {
  const assignments = [
    { playerId: "p1", matchId: "m1" },
    { playerId: "p2", matchId: "m1" },
  ];
  const existing = new Set(["m1:p1"]); // p1 already convoqué from a first "Publier"
  const result = convocationsToCreate(assignments, existing);
  assert.deepEqual(result, [{ matchId: "m1", playerId: "p2" }]);
});

test("convocationsToCreate: publishing with nothing new to add returns an empty list", () => {
  const assignments = [{ playerId: "p1", matchId: "m1" }];
  const existing = new Set(["m1:p1"]);
  assert.deepEqual(convocationsToCreate(assignments, existing), []);
});

test("convocationsToCreate: never mixes up two different matches for the same player", () => {
  const assignments = [{ playerId: "p1", matchId: "m2" }];
  const existing = new Set(["m1:p1"]); // p1 already convoqué for a DIFFERENT match
  assert.deepEqual(convocationsToCreate(assignments, existing), [{ matchId: "m2", playerId: "p1" }]);
});
