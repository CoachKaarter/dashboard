import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Regression guard for the "Player.teamId leaks match visibility" bug: a
// parent must only ever see a Match's details once MatchConvocation exists
// for THEIR child, never by querying Match.teamId / parent.player.teamId
// directly (that leaks the adversaire/horaire/team of matches the child may
// not even end up playing). This repo has no DB-integration test harness —
// every other test here is a pure-function test — so this asserts the
// dangerous pattern doesn't reappear in source. getParentPlanItems
// (src/lib/parent-planning.ts) is the single place every parent-facing
// surface (Planning semaine/mois/agenda, /parent/matchs, /parent home) reads
// matches from, so that's the one file this actually needs to guard.
const repoSrc = dirname(fileURLToPath(import.meta.url)); // .../src/lib

function read(relative: string) {
  return readFileSync(join(repoSrc, relative), "utf8");
}

test("getParentPlanItems (the shared parent match/session fetcher) never queries Match by parent.player.teamId", () => {
  const src = read("parent-planning.ts");
  assert.match(src, /matchConvocation\.findMany/, "must still source visible matches via MatchConvocation");
  assert.doesNotMatch(src, /teamId:\s*parent\.player\.teamId/, "must never filter Match by the player's administrative team");
});

test("parent home page never queries Match by parent.player.teamId", () => {
  // Accueil Parent v2 : l'agrégation vit désormais dans getParentHomeState
  // (parent-home.ts), plus dans page.tsx lui-même — page.tsx ne fait plus
  // que consommer son résultat et ne doit donc plus contenir de requête
  // Prisma du tout.
  const home = read("parent-home.ts");
  assert.match(home, /matchConvocation\.findFirst/, "must still source the weekend match via MatchConvocation");
  assert.doesNotMatch(home, /teamId:\s*parent\.player\.teamId/, "must never filter Match by the player's administrative team");

  const page = read("../app/parent/(app)/page.tsx");
  assert.doesNotMatch(page, /prisma\.match/i, "the page itself must not query Match directly — it only reads getParentHomeState's result");
  assert.doesNotMatch(page, /teamId:\s*parent\.player\.teamId/, "must never filter Match by the player's administrative team");
});

test("parent matchs page never queries Match directly (must go through getParentPlanItems)", () => {
  const src = read("../app/parent/(app)/matchs/page.tsx");
  assert.match(src, /getParentPlanItems/, "must source visible matches via the shared, MatchConvocation-scoped fetcher");
  assert.doesNotMatch(src, /teamId:\s*parent\.player\.teamId/, "must never filter Match by the player's administrative team");
});

test("parent planning page never queries Match directly (must go through getParentPlanItems)", () => {
  const src = read("../app/parent/(app)/planning/page.tsx");
  assert.match(src, /getParentPlanItems/, "must source visible matches via the shared, MatchConvocation-scoped fetcher");
  assert.doesNotMatch(src, /teamId:\s*parent\.player\.teamId/, "must never filter Match by the player's administrative team");
});
