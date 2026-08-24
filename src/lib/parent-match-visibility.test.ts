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
// dangerous pattern doesn't reappear in source, at the two call sites that
// were actually broken.
const repoSrc = dirname(dirname(fileURLToPath(import.meta.url))); // .../src

function read(relative: string) {
  return readFileSync(join(repoSrc, relative), "utf8");
}

test("parent home page never queries Match by parent.player.teamId", () => {
  const src = read("app/parent/(app)/page.tsx");
  assert.match(src, /matchConvocation\.findFirst/, "must still source the weekend match via MatchConvocation");
  assert.doesNotMatch(src, /teamId:\s*parent\.player\.teamId/, "must never filter Match by the player's administrative team");
});

test("parent matchs page never queries Match by parent.player.teamId", () => {
  const src = read("app/parent/(app)/matchs/page.tsx");
  assert.match(src, /matchConvocation\.findMany/, "must still source visible matches via MatchConvocation");
  assert.doesNotMatch(src, /teamId:\s*parent\.player\.teamId/, "must never filter Match by the player's administrative team");
});
