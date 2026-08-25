import { test } from "node:test";
import assert from "node:assert/strict";
import { expandScopeToCategories } from "./authz";

const ALL_TEAMS = [
  { id: "u12a", category: "U12" },
  { id: "u12b", category: "U12" },
  { id: "u13a", category: "U13" },
  { id: "u13b", category: "U13" },
  { id: "u13c", category: "U13" },
];

test("expandScopeToCategories: a coach assigned to one U13 team can access every U13 team, not just their own", () => {
  const scope = expandScopeToCategories(["u13a"], ALL_TEAMS);
  assert.deepEqual(new Set(scope), new Set(["u13a", "u13b", "u13c"]));
});

test("expandScopeToCategories: never leaks into the other category", () => {
  const scope = expandScopeToCategories(["u13a"], ALL_TEAMS);
  assert.equal(scope.includes("u12a"), false);
  assert.equal(scope.includes("u12b"), false);
});

test("expandScopeToCategories: a coach assigned to teams in both categories gets both categories in full", () => {
  const scope = expandScopeToCategories(["u12a", "u13b"], ALL_TEAMS);
  assert.deepEqual(new Set(scope), new Set(["u12a", "u12b", "u13a", "u13b", "u13c"]));
});

test("expandScopeToCategories: a coach with no team assignment gets an empty scope, not everything", () => {
  assert.deepEqual(expandScopeToCategories([], ALL_TEAMS), []);
});

test("expandScopeToCategories: an assigned team id that no longer exists doesn't widen or crash", () => {
  const scope = expandScopeToCategories(["does-not-exist"], ALL_TEAMS);
  assert.deepEqual(scope, ["does-not-exist"]);
});
