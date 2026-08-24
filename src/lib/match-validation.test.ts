import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidFormation, isValidSlotIndex, scoreSchema, statRowSchema, neededSchema } from "./match-validation";

test("isValidFormation: only formations whitelisted for the team's format are accepted", () => {
  assert.equal(isValidFormation("Foot à 8", "1-3-3-1"), true);
  assert.equal(isValidFormation("Foot à 8", "1-4-3-3"), false); // an 11-a-side formation
  assert.equal(isValidFormation("Foot à 11", "1-4-3-3"), true);
  assert.equal(isValidFormation("Foot à 11", "1-3-3-1"), false); // an 8-a-side formation
  assert.equal(isValidFormation("Foot à 8", "not-a-real-formation"), false);
});

test("isValidSlotIndex: bounded by the formation's actual position count", () => {
  assert.equal(isValidSlotIndex("1-3-3-1", 0), true);
  assert.equal(isValidSlotIndex("1-3-3-1", 7), true); // 8 positions: 0..7
  assert.equal(isValidSlotIndex("1-3-3-1", 8), false);
  assert.equal(isValidSlotIndex("1-3-3-1", -1), false);
  assert.equal(isValidSlotIndex("1-3-3-1", 1.5), false);
  assert.equal(isValidSlotIndex("1-4-3-3", 10), true); // 11 positions: 0..10
  assert.equal(isValidSlotIndex("1-4-3-3", 11), false);
});

test("scoreSchema: rejects negative, non-integer, and absurd scores", () => {
  assert.equal(scoreSchema.safeParse({ scoreFor: 3, scoreAgainst: 1 }).success, true);
  assert.equal(scoreSchema.safeParse({ scoreFor: -1, scoreAgainst: 1 }).success, false);
  assert.equal(scoreSchema.safeParse({ scoreFor: 1.5, scoreAgainst: 1 }).success, false);
  assert.equal(scoreSchema.safeParse({ scoreFor: 51, scoreAgainst: 1 }).success, false);
  assert.equal(scoreSchema.safeParse({ scoreFor: Number.NaN, scoreAgainst: 1 }).success, false);
});

test("statRowSchema: bounds minutes/goals/assists/note", () => {
  const base = { role: "Titulaire" as const, position: null, comment: null };
  assert.equal(statRowSchema.safeParse({ ...base, minutes: 45, goals: 1, assists: 0, note: 7.5 }).success, true);
  assert.equal(statRowSchema.safeParse({ ...base, minutes: -5, goals: 0, assists: 0, note: null }).success, false);
  assert.equal(statRowSchema.safeParse({ ...base, minutes: 200, goals: 0, assists: 0, note: null }).success, false);
  assert.equal(statRowSchema.safeParse({ ...base, minutes: 45, goals: -1, assists: 0, note: null }).success, false);
  assert.equal(statRowSchema.safeParse({ ...base, minutes: 45, goals: 0, assists: 0, note: 11 }).success, false);
  assert.equal(statRowSchema.safeParse({ ...base, minutes: 45, goals: 0, assists: 0, note: null }).success, true);
});

test("statRowSchema: role must be Titulaire or Remplaçant, position is free text", () => {
  const base = { minutes: 45, goals: 0, assists: 0, note: null, comment: null };
  assert.equal(statRowSchema.safeParse({ ...base, role: "Titulaire", position: "Défenseur central" }).success, true);
  assert.equal(statRowSchema.safeParse({ ...base, role: "Remplaçant", position: null }).success, true);
  assert.equal(statRowSchema.safeParse({ ...base, role: "Capitaine", position: null }).success, false);
});

test("neededSchema: bounds squad size needed", () => {
  assert.equal(neededSchema.safeParse(12).success, true);
  assert.equal(neededSchema.safeParse(0).success, false);
  assert.equal(neededSchema.safeParse(-3).success, false);
  assert.equal(neededSchema.safeParse(31).success, false);
  assert.equal(neededSchema.safeParse(Number.NaN).success, false);
});
