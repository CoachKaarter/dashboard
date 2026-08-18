import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSessionBlockSnapshot } from "./training-content-snapshot";

// Cases 87/88/89 — snapshot independence: the value copied into the
// SessionBlock at add-time must never change just because the source
// TrainingContentItem is mutated afterward.
test("buildSessionBlockSnapshot: captures the source's current values (space 20x20)", () => {
  const source = {
    id: "item-1",
    type: "SITUATION",
    title: "Jeu de face / 3e homme",
    defaultDurationMinutes: 15,
    objective: null,
    organization: null,
    instructions: null,
    coachingPoints: null,
    variations: null,
    space: "20x20",
    equipment: null,
    imageUrl: null,
  };
  const snapshot = buildSessionBlockSnapshot(source, 0);
  assert.equal(snapshot.space, "20x20");
  assert.equal(snapshot.sourceLibraryItemId, "item-1");
  assert.equal(snapshot.durationMinutes, 15);
});

test("buildSessionBlockSnapshot: mutating the source object after the fact never changes an already-built snapshot", () => {
  const source = {
    id: "item-1",
    type: "SITUATION",
    title: "Jeu de face / 3e homme",
    defaultDurationMinutes: 15,
    objective: null,
    organization: null,
    instructions: null,
    coachingPoints: null,
    variations: null,
    space: "20x20",
    equipment: null,
    imageUrl: null,
  };
  const snapshotA = buildSessionBlockSnapshot(source, 0);
  // Library item is edited later (e.g. in November): space 20x20 -> 30x30.
  const mutated = { ...source, space: "30x30" };
  const snapshotB = buildSessionBlockSnapshot(mutated, 0);

  assert.equal(snapshotA.space, "20x20"); // Session A (already built) unaffected
  assert.equal(snapshotB.space, "30x30"); // Session B (new usage) gets the new value
});

test("buildSessionBlockSnapshot: falls back to 15 minutes when the library item has no default duration", () => {
  const source = {
    id: "item-2",
    type: "JEU",
    title: "8c8",
    defaultDurationMinutes: null,
    objective: null,
    organization: null,
    instructions: null,
    coachingPoints: null,
    variations: null,
    space: null,
    equipment: null,
    imageUrl: null,
  };
  assert.equal(buildSessionBlockSnapshot(source, 0).durationMinutes, 15);
});
