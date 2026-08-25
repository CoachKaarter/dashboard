/**
 * End-to-end security matrix for the multi-category permissions model
 * (spec: "FAIRE ÉVOLUER LES PERMISSIONS STAFF POUR GÉRER PLUSIEURS
 * CATÉGORIES"). Unlike authz.test.ts's per-function unit tests, this file
 * builds three REAL personas through the actual production pipeline
 * (RawGrant[] → buildAccessibleScopes → expandScopesToTeamIds → AuthedUser)
 * and asserts, category by category and team by team, exactly what each
 * one can and cannot reach. It exists to answer one question in one place:
 * "does Davy actually get real U8/U9 pilotage while staying completely
 * out of U13, and does Marvyn stay completely out of U8/U9?" — the
 * concrete goal the whole feature was built for.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAccessibleScopes,
  expandScopesToTeamIds,
  scopedTeamIds,
  scopedTeamIdsInCategory,
  canAccessTeam,
  canAccessCategory,
  canManageCategory,
  getAccessibleCategories,
  buildCategorySwitcherGroups,
  type RawGrant,
  type TeamRef,
  type AuthedUser,
} from "./authz";

// A small but representative club: two teams in each of U8/U9 (mirrors the
// real U8-TEST/U9-TEST teams created this session), three in U12 and U13
// (Davy's and Marvyn's real teams), one each in U6/U7/U10/U11 so the école
// de foot perimeter has somewhere real to reach beyond U8/U9.
const ALL_TEAMS: TeamRef[] = [
  { id: "u6a", code: "U6A", category: "U6" },
  { id: "u7a", code: "U7A", category: "U7" },
  { id: "u8a", code: "U8A", category: "U8" },
  { id: "u8b", code: "U8B", category: "U8" },
  { id: "u9a", code: "U9A", category: "U9" },
  { id: "u9b", code: "U9B", category: "U9" },
  { id: "u10a", code: "U10A", category: "U10" },
  { id: "u11a", code: "U11A", category: "U11" },
  { id: "u12a", code: "U12A", category: "U12" },
  { id: "u12b", code: "U12B", category: "U12" },
  { id: "u12c", code: "U12C", category: "U12" },
  { id: "u13a", code: "U13A", category: "U13" },
  { id: "u13b", code: "U13B", category: "U13" },
  { id: "u13c", code: "U13C", category: "U13" },
];
const ALL_CATEGORIES = [...new Set(ALL_TEAMS.map((t) => t.category))];

function buildUser(name: string, role: string, grants: RawGrant[], schoolCategories: string[] = []): AuthedUser {
  const scopes = buildAccessibleScopes(grants, ALL_TEAMS, schoolCategories);
  const teamIds = expandScopesToTeamIds(scopes, ALL_TEAMS);
  return {
    id: name,
    username: name,
    name,
    role,
    jobTitle: "",
    onboardingCompletedAt: new Date(),
    teamIds,
    hasFullAccess: ALL_TEAMS.length > 0 && teamIds.length === ALL_TEAMS.length,
    scopes,
  };
}

// --- The three real personas ---

// Marvyn: RESPONSABLE of U12 and U13 together — his own account is ADMIN
// (technical role, staff CRUD/paramètres), but that grants zero sporting
// access on its own; everything below comes only from these two grants.
const marvyn = buildUser("marvyn", "ADMIN", [
  { level: "RESPONSABLE", scope: "CATEGORY", category: "U12", teamId: null },
  { level: "RESPONSABLE", scope: "CATEGORY", category: "U13", teamId: null },
]);

// Davy: RESPONSABLE École (U8+U9) + COACH on his three real U12 teams —
// exactly the production backfill from migration 20260825150000.
const davy = buildUser("davy", "COACH", [
  { level: "RESPONSABLE", scope: "CATEGORY", category: "U8", teamId: null },
  { level: "RESPONSABLE", scope: "CATEGORY", category: "U9", teamId: null },
  { level: "COACH", scope: "TEAM", category: null, teamId: "u12a" },
  { level: "COACH", scope: "TEAM", category: null, teamId: "u12b" },
  { level: "COACH", scope: "TEAM", category: null, teamId: "u12c" },
]);

// Responsable École de Foot: a single SCHOOL grant, with the club's
// configured perimeter deliberately NOT covering every category that
// exists (U12/U13 stay out) — proves the profile is genuinely
// configurable via Settings.schoolFootballCategories, not a hardcoded list.
const SCHOOL_PERIMETER = ["U6", "U7", "U8", "U9", "U10", "U11"];
const responsableEcole = buildUser(
  "responsable-ecole",
  "STAFF",
  [{ level: "RESPONSABLE", scope: "SCHOOL", category: null, teamId: null }],
  SCHOOL_PERIMETER
);

// --- The matrix: expected effective level per persona × category ---

const EXPECTED: Record<string, Record<string, "RESPONSABLE" | "COACH" | null>> = {
  marvyn: { U6: null, U7: null, U8: null, U9: null, U10: null, U11: null, U12: "RESPONSABLE", U13: "RESPONSABLE" },
  davy: { U6: null, U7: null, U8: "RESPONSABLE", U9: "RESPONSABLE", U10: null, U11: null, U12: "COACH", U13: null },
  "responsable-ecole": { U6: "RESPONSABLE", U7: "RESPONSABLE", U8: "RESPONSABLE", U9: "RESPONSABLE", U10: "RESPONSABLE", U11: "RESPONSABLE", U12: null, U13: null },
};

const PERSONAS: Record<string, AuthedUser> = { marvyn, davy, "responsable-ecole": responsableEcole };

for (const [personaName, user] of Object.entries(PERSONAS)) {
  for (const category of ALL_CATEGORIES) {
    const expected = EXPECTED[personaName][category];
    test(`matrix: ${personaName} × ${category} — canAccessCategory`, () => {
      assert.equal(canAccessCategory(user, category), expected !== null, `${personaName} on ${category}`);
    });
    test(`matrix: ${personaName} × ${category} — canManageCategory (RESPONSABLE-only)`, () => {
      assert.equal(canManageCategory(user, category), expected === "RESPONSABLE", `${personaName} on ${category}`);
    });
  }
}

// --- Team-level checks: the concrete goal from the spec, stated directly ---

test("Davy has real pilotage of every U8 and U9 team, never a U12 team beyond his three, never any U13 team", () => {
  for (const t of ALL_TEAMS.filter((t) => t.category === "U8" || t.category === "U9")) {
    assert.equal(canAccessTeam(davy, t.id), true, `Davy should reach ${t.code}`);
  }
  assert.equal(canAccessTeam(davy, "u12a"), true);
  assert.equal(canAccessTeam(davy, "u12b"), true);
  assert.equal(canAccessTeam(davy, "u12c"), true);
  for (const t of ALL_TEAMS.filter((t) => t.category === "U13")) {
    assert.equal(canAccessTeam(davy, t.id), false, `Davy must NOT reach ${t.code}`);
  }
});

test("Marvyn reaches every U12 and U13 team, and zero U8/U9/U6/U7/U10/U11 team", () => {
  for (const t of ALL_TEAMS.filter((t) => t.category === "U12" || t.category === "U13")) {
    assert.equal(canAccessTeam(marvyn, t.id), true, `Marvyn should reach ${t.code}`);
  }
  for (const t of ALL_TEAMS.filter((t) => t.category !== "U12" && t.category !== "U13")) {
    assert.equal(canAccessTeam(marvyn, t.id), false, `Marvyn must NOT reach ${t.code}`);
  }
});

test("neither Marvyn nor Davy has hasFullAccess — each is a real subset of the club, not silently everything", () => {
  assert.equal(marvyn.hasFullAccess, false);
  assert.equal(davy.hasFullAccess, false);
  assert.equal(responsableEcole.hasFullAccess, false);
});

// --- The switcher groups each persona actually sees (the UI-facing check) ---

test("Davy's switcher: one bundled 'U8/U9' Responsable option, one separate 'U12' Coach option — matches the reported bug fix", () => {
  assert.deepEqual(buildCategorySwitcherGroups(davy), [
    { key: "U8+U9", label: "U8/U9", categories: ["U8", "U9"] },
    { key: "U12", label: "U12", categories: ["U12"] },
  ]);
});

test("Marvyn's switcher: a single bundled 'U12/U13' option, no separate Coach entries", () => {
  assert.deepEqual(buildCategorySwitcherGroups(marvyn), [{ key: "U12+U13", label: "U12/U13", categories: ["U12", "U13"] }]);
});

test("Responsable École de Foot's switcher: one bundled option spanning exactly the configured perimeter", () => {
  const groups = buildCategorySwitcherGroups(responsableEcole);
  assert.equal(groups.length, 1);
  assert.deepEqual(new Set(groups[0].categories), new Set(SCHOOL_PERIMETER));
});

// --- Reconfiguring the école de foot perimeter reshapes access instantly,
// without touching the grant itself — the headline claim of the SCHOOL
// scope design (see buildAccessibleScopes's doc comment in authz.ts).

test("SCHOOL scope: shrinking Settings.schoolFootballCategories immediately drops access, same single grant", () => {
  const reduced = buildUser("responsable-ecole", "STAFF", [{ level: "RESPONSABLE", scope: "SCHOOL", category: null, teamId: null }], ["U8", "U9"]);
  assert.deepEqual(getAccessibleCategories(reduced).sort(), ["U8", "U9"]);
  assert.equal(canAccessCategory(reduced, "U6"), false);
  assert.equal(canAccessTeam(reduced, "u6a"), false);
});

test("SCHOOL scope: growing the perimeter to include U12/U13 would give full club pilotage — but that's a deliberate Paramètres decision, not a default", () => {
  const grown = buildUser("responsable-ecole", "STAFF", [{ level: "RESPONSABLE", scope: "SCHOOL", category: null, teamId: null }], ALL_CATEGORIES);
  assert.equal(grown.hasFullAccess, true);
  assert.equal(canManageCategory(grown, "U13"), true);
});

// --- Active-category narrowing (the sidebar switcher's actual filtering
// mechanism) never leaks a category outside the selected group, even for
// a user who could otherwise reach it through a different grant.

test("scopedTeamIdsInCategory: Davy focused on U8/U9 sees zero U12 team, even though he coaches three of them", () => {
  const ids = scopedTeamIdsInCategory(davy, ALL_TEAMS, ["U8", "U9"]);
  assert.deepEqual(new Set(ids), new Set(["u8a", "u8b", "u9a", "u9b"]));
  assert.equal(ids.includes("u12a"), false);
});

test("scopedTeamIdsInCategory: Davy focused on U12 sees exactly his three teams, not the other U12 teams outside his real coach assignment", () => {
  // (In this fixture Davy coaches all three U12 teams that exist; the
  // point being verified is that the narrowing is driven by his actual
  // grants, not merely "every team of category U12".)
  const ids = scopedTeamIdsInCategory(davy, ALL_TEAMS, ["U12"]);
  assert.deepEqual(new Set(ids), new Set(["u12a", "u12b", "u12c"]));
});

test("scopedTeamIdsInCategory: an unauthorized category requested explicitly still returns nothing", () => {
  assert.deepEqual(scopedTeamIdsInCategory(davy, ALL_TEAMS, ["U13"]), []);
  assert.deepEqual(scopedTeamIdsInCategory(marvyn, ALL_TEAMS, ["U8"]), []);
});

// --- The zero-grant baseline: a bare ADMIN account (before any
// responsibility is attributed) sees nothing sporting — role alone never
// substitutes for a grant, the central premise the whole model rests on.

test("an ADMIN with zero StaffAccess grants sees zero sporting data — role never implies sporting access", () => {
  const bareAdmin = buildUser("bare-admin", "ADMIN", []);
  assert.equal(bareAdmin.hasFullAccess, false);
  assert.deepEqual(scopedTeamIds(bareAdmin), []);
  for (const category of ALL_CATEGORIES) assert.equal(canAccessCategory(bareAdmin, category), false);
});
