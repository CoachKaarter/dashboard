import { test } from "node:test";
import assert from "node:assert/strict";
import { contentItemSchema, slugifyTag } from "./training-content-validation";

const base = {
  title: "Jeu de face",
  type: "SITUATION",
  description: null,
  objective: null,
  organization: null,
  instructions: null,
  coachingPoints: null,
  variations: null,
  space: null,
  equipment: null,
  imageUrl: null,
  defaultDurationMinutes: 15,
  format: null,
  categories: [],
  visibility: "PERSONAL",
};

// Case 74 — minPlayers <= maxPlayers.
test("contentItemSchema: refuses minPlayers > maxPlayers", () => {
  const result = contentItemSchema.safeParse({ ...base, minPlayers: 16, maxPlayers: 12 });
  assert.equal(result.success, false);
});

test("contentItemSchema: accepts minPlayers <= maxPlayers", () => {
  const result = contentItemSchema.safeParse({ ...base, minPlayers: 10, maxPlayers: 16 });
  assert.equal(result.success, true);
});

test("contentItemSchema: accepts when only one of minPlayers/maxPlayers is set", () => {
  assert.equal(contentItemSchema.safeParse({ ...base, minPlayers: 10, maxPlayers: null }).success, true);
  assert.equal(contentItemSchema.safeParse({ ...base, minPlayers: null, maxPlayers: 16 }).success, true);
});

test("contentItemSchema: rejects an arbitrary type outside the SessionBlock referential", () => {
  assert.equal(contentItemSchema.safeParse({ ...base, type: "HACK" }).success, false);
});

test("contentItemSchema: rejects an empty title", () => {
  assert.equal(contentItemSchema.safeParse({ ...base, title: "" }).success, false);
});

test("slugifyTag: normalizes accents, case, and spacing", () => {
  assert.equal(slugifyTag("Troisième homme"), "troisieme-homme");
  assert.equal(slugifyTag("  Réaction à la perte  "), "reaction-a-la-perte");
});
