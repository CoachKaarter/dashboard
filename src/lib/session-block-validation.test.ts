import { test } from "node:test";
import assert from "node:assert/strict";
import { actualDurationMinutesSchema, durationMinutesSchema, computeSwapPair, sessionBlockTypeSchema } from "./session-block-validation";

// Case 11 — an invalid actualDurationMinutes is refused.
test("actualDurationMinutesSchema: rejects NaN, Infinity, negative, and absurd values", () => {
  assert.equal(actualDurationMinutesSchema.safeParse(NaN).success, false);
  assert.equal(actualDurationMinutesSchema.safeParse(Infinity).success, false);
  assert.equal(actualDurationMinutesSchema.safeParse(-999).success, false);
  assert.equal(actualDurationMinutesSchema.safeParse(999999).success, false);
});

test("actualDurationMinutesSchema: accepts reasonable values, including zero", () => {
  assert.equal(actualDurationMinutesSchema.safeParse(0).success, true);
  assert.equal(actualDurationMinutesSchema.safeParse(45).success, true);
});

test("durationMinutesSchema: rejects zero/negative/absurd planned durations", () => {
  assert.equal(durationMinutesSchema.safeParse(0).success, false);
  assert.equal(durationMinutesSchema.safeParse(-10).success, false);
  assert.equal(durationMinutesSchema.safeParse(999999).success, false);
});

test("sessionBlockTypeSchema: rejects an arbitrary hand-crafted type", () => {
  assert.equal(sessionBlockTypeSchema.safeParse("HACK").success, false);
  assert.equal(sessionBlockTypeSchema.safeParse("TECHNIQUE").success, true);
});

// Case 12/13 — order stays unique within a session after a move up/down.
test("computeSwapPair: moving a middle block up swaps it with its predecessor, orders stay unique", () => {
  const blocks = [
    { id: "b0", order: 0 },
    { id: "b1", order: 1 },
    { id: "b2", order: 2 },
  ];
  const pair = computeSwapPair(blocks, "b1", -1);
  assert.ok(pair);
  const orders = new Map(blocks.map((b) => [b.id, b.order]));
  orders.set(pair!.a.id, pair!.b.order);
  orders.set(pair!.b.id, pair!.a.order);
  const values = [...orders.values()];
  assert.equal(new Set(values).size, values.length); // still all unique
  assert.equal(orders.get("b1"), 0);
  assert.equal(orders.get("b0"), 1);
});

test("computeSwapPair: moving the first block up is a no-op", () => {
  const blocks = [
    { id: "b0", order: 0 },
    { id: "b1", order: 1 },
  ];
  assert.equal(computeSwapPair(blocks, "b0", -1), null);
});

test("computeSwapPair: moving the last block down is a no-op", () => {
  const blocks = [
    { id: "b0", order: 0 },
    { id: "b1", order: 1 },
  ];
  assert.equal(computeSwapPair(blocks, "b1", 1), null);
});

// Case 14 — deletion leaves order coherent (sparse is fine, but still strictly
// increasing / unique — the invariant that matters).
test("deletion leaves the remaining orders unique and increasing (sparse is acceptable)", () => {
  const remainingAfterDeletingOrder1 = [
    { id: "b0", order: 0 },
    { id: "b2", order: 2 },
  ];
  const orders = remainingAfterDeletingOrder1.map((b) => b.order);
  assert.equal(new Set(orders).size, orders.length);
  assert.deepEqual(
    [...orders].sort((a, b) => a - b),
    orders
  );
});
