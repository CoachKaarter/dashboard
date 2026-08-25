import { test } from "node:test";
import assert from "node:assert/strict";
import { canViewContentItem, canEditContentItem } from "./training-content-scope";
import type { AuthedUser } from "./authz";

function user(overrides: Partial<AuthedUser>): AuthedUser {
  return {
    id: "u1",
    username: "coach",
    name: "Coach",
    role: "COACH",
    jobTitle: "Coach",
    onboardingCompletedAt: new Date(),
    teamIds: [],
    hasFullAccess: false,
    scopes: [],
    ...overrides,
  };
}

// Case 92 — Coach A's PERSONAL item is refused to Coach B.
test("canViewContentItem: PERSONAL is refused to another coach", () => {
  const item = { createdById: "u1", visibility: "PERSONAL", archived: false };
  assert.equal(canViewContentItem(user({ id: "u2" }), item), false);
});

test("canViewContentItem: PERSONAL is visible to its own creator", () => {
  const item = { createdById: "u1", visibility: "PERSONAL", archived: false };
  assert.equal(canViewContentItem(user({ id: "u1" }), item), true);
});

test("canViewContentItem: PERSONAL is visible to ADMIN regardless of creator", () => {
  const item = { createdById: "u1", visibility: "PERSONAL", archived: false };
  assert.equal(canViewContentItem(user({ id: "admin1", role: "ADMIN" }), item), true);
});

// Case 92 — Coach A's SHARED item: Coach B can view but not edit.
test("canViewContentItem: SHARED is visible to any staff", () => {
  const item = { createdById: "u1", visibility: "SHARED", archived: false };
  assert.equal(canViewContentItem(user({ id: "u2" }), item), true);
});

test("canEditContentItem: only the creator or ADMIN can edit, even when SHARED", () => {
  const item = { createdById: "u1", visibility: "SHARED", archived: false };
  assert.equal(canEditContentItem(user({ id: "u1" }), item), true);
  assert.equal(canEditContentItem(user({ id: "u2" }), item), false);
  assert.equal(canEditContentItem(user({ id: "admin1", role: "ADMIN" }), item), true);
});

test("canEditContentItem: refused for a PERSONAL item belonging to someone else", () => {
  const item = { createdById: "u1", visibility: "PERSONAL", archived: false };
  assert.equal(canEditContentItem(user({ id: "u2" }), item), false);
});
