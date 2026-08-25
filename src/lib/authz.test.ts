import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAccessibleScopes, expandScopesToTeamIds, scopedTeamIdsInCategory, type RawGrant, type TeamRef, type AuthedUser } from "./authz";

function user(overrides: Partial<AuthedUser>): AuthedUser {
  return {
    id: "u1",
    username: "staff",
    name: "Staff",
    role: "COACH",
    jobTitle: "Staff",
    onboardingCompletedAt: new Date(),
    teamIds: [],
    hasFullAccess: false,
    scopes: [],
    ...overrides,
  };
}

const ALL_TEAMS: TeamRef[] = [
  { id: "u8a", code: "U8A", category: "U8" },
  { id: "u9a", code: "U9A", category: "U9" },
  { id: "u12a", code: "U12A", category: "U12" },
  { id: "u12b", code: "U12B", category: "U12" },
  { id: "u13a", code: "U13A", category: "U13" },
  { id: "u13b", code: "U13B", category: "U13" },
  { id: "u13c", code: "U13C", category: "U13" },
];

const SCHOOL_CATEGORIES = ["U6", "U7", "U8", "U9", "U10", "U11", "U12", "U13"];

test("buildAccessibleScopes: Marvyn — RESPONSABLE on U12 and U13, nothing else — never touches U8/U9", () => {
  const grants: RawGrant[] = [
    { level: "RESPONSABLE", scope: "CATEGORY", category: "U12", teamId: null },
    { level: "RESPONSABLE", scope: "CATEGORY", category: "U13", teamId: null },
  ];
  const scopes = buildAccessibleScopes(grants, ALL_TEAMS, SCHOOL_CATEGORIES);
  assert.deepEqual(
    scopes.sort((a, b) => a.category.localeCompare(b.category)),
    [
      { kind: "category", category: "U12", level: "RESPONSABLE" },
      { kind: "category", category: "U13", level: "RESPONSABLE" },
    ]
  );
  const teamIds = expandScopesToTeamIds(scopes, ALL_TEAMS);
  assert.deepEqual(new Set(teamIds), new Set(["u12a", "u12b", "u13a", "u13b", "u13c"]));
  assert.equal(teamIds.includes("u8a"), false);
  assert.equal(teamIds.includes("u9a"), false);
});

test("buildAccessibleScopes: Davy — RESPONSABLE U8, RESPONSABLE U9, COACH on exactly one U12 team, no U13 at all", () => {
  const grants: RawGrant[] = [
    { level: "RESPONSABLE", scope: "CATEGORY", category: "U8", teamId: null },
    { level: "RESPONSABLE", scope: "CATEGORY", category: "U9", teamId: null },
    { level: "COACH", scope: "TEAM", category: null, teamId: "u12a" },
  ];
  const scopes = buildAccessibleScopes(grants, ALL_TEAMS, SCHOOL_CATEGORIES);
  const teamIds = expandScopesToTeamIds(scopes, ALL_TEAMS);
  assert.deepEqual(new Set(teamIds), new Set(["u8a", "u9a", "u12a"]));
  // Full U8/U9 pilotage (every team of the category), but only the exact U12A team — not U12B, not U13.
  assert.equal(teamIds.includes("u12b"), false);
  assert.equal(teamIds.includes("u13a"), false);
  const u12Scope = scopes.find((s) => s.kind === "team" && s.teamId === "u12a");
  assert.equal(u12Scope?.level, "COACH");
});

test("buildAccessibleScopes: a COACH TEAM grant never auto-widens to the rest of that team's category", () => {
  const grants: RawGrant[] = [{ level: "COACH", scope: "TEAM", category: null, teamId: "u13a" }];
  const teamIds = expandScopesToTeamIds(buildAccessibleScopes(grants, ALL_TEAMS, SCHOOL_CATEGORIES), ALL_TEAMS);
  assert.deepEqual(teamIds, ["u13a"]);
});

test("buildAccessibleScopes: SCHOOL scope expands to every configured école-de-foot category, and only those", () => {
  const grants: RawGrant[] = [{ level: "RESPONSABLE", scope: "SCHOOL", category: null, teamId: null }];
  const scopes = buildAccessibleScopes(grants, ALL_TEAMS, ["U8", "U9"]); // school perimeter reduced in Paramètres
  const teamIds = expandScopesToTeamIds(scopes, ALL_TEAMS);
  assert.deepEqual(new Set(teamIds), new Set(["u8a", "u9a"]));
  assert.equal(teamIds.includes("u12a"), false);
});

test("buildAccessibleScopes: overlapping grants on the same category keep the higher level (RESPONSABLE over COACH)", () => {
  const grants: RawGrant[] = [
    { level: "COACH", scope: "CATEGORY", category: "U9", teamId: null },
    { level: "RESPONSABLE", scope: "CATEGORY", category: "U9", teamId: null },
  ];
  const scopes = buildAccessibleScopes(grants, ALL_TEAMS, SCHOOL_CATEGORIES);
  assert.equal(scopes.length, 1);
  assert.equal(scopes[0].level, "RESPONSABLE");
});

test("buildAccessibleScopes: a stale team id that no longer exists is dropped, not carried through as a dangling grant", () => {
  const grants: RawGrant[] = [{ level: "COACH", scope: "TEAM", category: null, teamId: "does-not-exist" }];
  const scopes = buildAccessibleScopes(grants, ALL_TEAMS, SCHOOL_CATEGORIES);
  assert.deepEqual(scopes, []);
});

test("buildAccessibleScopes: no grants at all means no access — never defaults to everything", () => {
  const scopes = buildAccessibleScopes([], ALL_TEAMS, SCHOOL_CATEGORIES);
  assert.deepEqual(scopes, []);
  assert.deepEqual(expandScopesToTeamIds(scopes, ALL_TEAMS), []);
});

// scopedTeamIdsInCategory — the active-category narrowing behind the sidebar
// switcher (src/lib/active-category.ts): every screen it feeds must still
// respect the underlying StaffAccess grant, never just the category name.
test("scopedTeamIdsInCategory: Davy on active category U8 sees only U8 teams, never U12 even though he's also a coach there", () => {
  const davy = user({ teamIds: ["u8a", "u9a", "u12a"] });
  assert.deepEqual(new Set(scopedTeamIdsInCategory(davy, ALL_TEAMS, "U8")), new Set(["u8a"]));
});

test("scopedTeamIdsInCategory: switching active category to U9 shows U9 and nothing else", () => {
  const davy = user({ teamIds: ["u8a", "u9a", "u12a"] });
  assert.deepEqual(scopedTeamIdsInCategory(davy, ALL_TEAMS, "U9"), ["u9a"]);
});

test("scopedTeamIdsInCategory: a category the user has no grant for at all yields nothing, even if named explicitly", () => {
  const davy = user({ teamIds: ["u8a", "u9a", "u12a"] });
  assert.deepEqual(scopedTeamIdsInCategory(davy, ALL_TEAMS, "U13"), []);
});

test("scopedTeamIdsInCategory: full access (hasFullAccess) still narrows to just the active category's real teams", () => {
  const admin = user({ hasFullAccess: true, teamIds: ALL_TEAMS.map((t) => t.id) });
  assert.deepEqual(new Set(scopedTeamIdsInCategory(admin, ALL_TEAMS, "U13")), new Set(["u13a", "u13b", "u13c"]));
});

test("scopedTeamIdsInCategory: category null skips the narrowing and returns every accessible team", () => {
  const davy = user({ teamIds: ["u8a", "u9a", "u12a"] });
  assert.deepEqual(new Set(scopedTeamIdsInCategory(davy, ALL_TEAMS, null)), new Set(["u8a", "u9a", "u12a"]));
});
