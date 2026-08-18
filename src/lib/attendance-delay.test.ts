import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDelayMinutes } from "./attendance-delay";

test("computeDelayMinutes: arrival after planned start rounds to the nearest minute", () => {
  const planned = new Date("2026-08-18T16:15:00.000Z");
  const arrival = new Date("2026-08-18T16:23:30.000Z");
  assert.equal(computeDelayMinutes(arrival, planned), 9); // 8.5 min -> rounds to 9
});

test("computeDelayMinutes: arrival exactly on time is zero", () => {
  const planned = new Date("2026-08-18T16:15:00.000Z");
  assert.equal(computeDelayMinutes(planned, planned), 0);
});

test("computeDelayMinutes: an early arrival never reports a negative delay", () => {
  const planned = new Date("2026-08-18T16:15:00.000Z");
  const arrival = new Date("2026-08-18T16:05:00.000Z");
  assert.equal(computeDelayMinutes(arrival, planned), 0);
});
