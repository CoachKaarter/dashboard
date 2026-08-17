import { test } from "node:test";
import assert from "node:assert/strict";
import { rpeSchema, preFeelingSchema, enjoymentSchema, availabilityStatusSchema } from "./parent-validation";

test("rpeSchema accepts 1..10, rejects out of range", () => {
  assert.equal(rpeSchema.safeParse("1").success, true);
  assert.equal(rpeSchema.safeParse("10").success, true);
  assert.equal(rpeSchema.safeParse("0").success, false);
  assert.equal(rpeSchema.safeParse("11").success, false);
  assert.equal(rpeSchema.safeParse("abc").success, false);
});

test("preFeelingSchema accepts 1..5 only", () => {
  assert.equal(preFeelingSchema.safeParse("1").success, true);
  assert.equal(preFeelingSchema.safeParse("5").success, true);
  assert.equal(preFeelingSchema.safeParse("6").success, false);
  assert.equal(preFeelingSchema.safeParse("0").success, false);
});

test("enjoymentSchema accepts 1..3 only", () => {
  assert.equal(enjoymentSchema.safeParse("1").success, true);
  assert.equal(enjoymentSchema.safeParse("3").success, true);
  assert.equal(enjoymentSchema.safeParse("4").success, false);
});

test("availabilityStatusSchema rejects arbitrary strings", () => {
  assert.equal(availabilityStatusSchema.safeParse("AVAILABLE").success, true);
  assert.equal(availabilityStatusSchema.safeParse("UNAVAILABLE").success, true);
  assert.equal(availabilityStatusSchema.safeParse("MAYBE").success, false);
});
