import { test } from "node:test";
import assert from "node:assert/strict";
import { playerMatchesSessionScope, blockMatchesSession } from "./session-scope";

// Case 1 — a coach authorized for a U13A session + a U12 player -> refused.
test("playerMatchesSessionScope: a U12 player is refused for a U13A-scoped session", () => {
  const session = { scopeTeamId: "team-u13a", category: "U13" };
  const player = { teamId: "team-u12b", category: "U12", archived: false };
  assert.equal(playerMatchesSessionScope(session, player), false);
});

test("playerMatchesSessionScope: a player from the session's own team is accepted", () => {
  const session = { scopeTeamId: "team-u13a", category: "U13" };
  const player = { teamId: "team-u13a", category: "U13", archived: false };
  assert.equal(playerMatchesSessionScope(session, player), true);
});

test("playerMatchesSessionScope: a category-wide session accepts any team in that category", () => {
  const session = { scopeTeamId: null, category: "U13" };
  const player = { teamId: "team-u13b", category: "U13", archived: false };
  assert.equal(playerMatchesSessionScope(session, player), true);
});

test("playerMatchesSessionScope: a category-wide session accepts a player with no fixed team at all", () => {
  const session = { scopeTeamId: null, category: "U13" };
  const player = { teamId: null, category: "U13", archived: false };
  assert.equal(playerMatchesSessionScope(session, player), true);
});

test("playerMatchesSessionScope: a team-scoped session refuses a player with no fixed team", () => {
  const session = { scopeTeamId: "team-u13a", category: "U13" };
  const player = { teamId: null, category: "U13", archived: false };
  assert.equal(playerMatchesSessionScope(session, player), false);
});

// Case 2 — an archived player is excluded even if otherwise in scope.
test("playerMatchesSessionScope: an archived player is always refused", () => {
  const session = { scopeTeamId: "team-u13a", category: "U13" };
  const player = { teamId: "team-u13a", category: "U13", archived: true };
  assert.equal(playerMatchesSessionScope(session, player), false);
});

// Cases 8/9/10 — a block from session A can't be touched via session B.
test("blockMatchesSession: a block belonging to another session is refused", () => {
  assert.equal(blockMatchesSession({ sessionId: "session-B" }, "session-A"), false);
});

test("blockMatchesSession: a block belonging to the given session is accepted", () => {
  assert.equal(blockMatchesSession({ sessionId: "session-A" }, "session-A"), true);
});

test("blockMatchesSession: a missing block is refused", () => {
  assert.equal(blockMatchesSession(null, "session-A"), false);
});
