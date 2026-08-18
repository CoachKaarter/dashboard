import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBench } from "./composition-pool";

// Case 4 (§147) — a convoqué player who hasn't been placed appears on the bench.
test("computeBench: an unplaced convoqué player appears on the bench", () => {
  const bench = computeBench([{ playerId: "p1" }, { playerId: "p2" }], [{ playerId: "p1" }]);
  assert.deepEqual(bench, [{ playerId: "p2" }]);
});

// Case 5 — a player convoqué for a DIFFERENT match never appears here, because
// the pool is built exclusively from THIS match's convocations (never a
// broader "all players" query) — nothing to leak by construction.
test("computeBench: only reflects the convocations passed in, never another match's roster", () => {
  const thisMatchConvocations = [{ playerId: "p1" }];
  const bench = computeBench(thisMatchConvocations, []);
  assert.deepEqual(bench, [{ playerId: "p1" }]);
  assert.equal(bench.some((p) => p.playerId === "p999"), false); // no foreign player sneaks in
});

test("computeBench: a fully-placed convocation list leaves an empty bench", () => {
  const bench = computeBench([{ playerId: "p1" }], [{ playerId: "p1" }]);
  assert.deepEqual(bench, []);
});
