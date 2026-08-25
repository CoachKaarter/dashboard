import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMeasurementTrend } from "./measurements";

test("computeMeasurementTrend: for a normal metric (bigger is better), an increase is 'up'", () => {
  assert.equal(computeMeasurementTrend(45, 40, false), "up");
  assert.equal(computeMeasurementTrend(40, 45, false), "down");
  assert.equal(computeMeasurementTrend(40, 40, false), "stable");
});

test("computeMeasurementTrend: for a timed test (lower is better), a faster time is 'up'", () => {
  assert.equal(computeMeasurementTrend(3.2, 3.6, true), "up"); // faster sprint = improvement
  assert.equal(computeMeasurementTrend(3.6, 3.2, true), "down"); // slower sprint = regression
  assert.equal(computeMeasurementTrend(3.2, 3.2, true), "stable");
});
