import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldCopyThemeObjective } from "./session-duplication";

// Case 91 — duplication copies content but never overwrites existing target data.
test("shouldCopyThemeObjective: copies onto an empty target", () => {
  const target = { theme: null, objective: null };
  const source = { theme: "Conservation", objective: "Jouer sous pression" };
  assert.equal(shouldCopyThemeObjective(target, source), true);
});

test("shouldCopyThemeObjective: never overwrites a target that already has its own theme/objective", () => {
  const target = { theme: "Déjà préparé", objective: null };
  const source = { theme: "Conservation", objective: "Jouer sous pression" };
  assert.equal(shouldCopyThemeObjective(target, source), false);
});

test("shouldCopyThemeObjective: nothing to copy when the source has neither", () => {
  const target = { theme: null, objective: null };
  const source = { theme: null, objective: null };
  assert.equal(shouldCopyThemeObjective(target, source), false);
});
