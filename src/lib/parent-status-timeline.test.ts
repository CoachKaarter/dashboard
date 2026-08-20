import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWeekendTimeline } from "./parent-status-timeline";

test("computeWeekendTimeline: initial state — only 'requested' is done and current", () => {
  const steps = computeWeekendTimeline({ answered: null, selectionStarted: false, convoked: false, convokedTeamCode: null });
  assert.deepEqual(steps.map((s) => s.done), [true, false, false, false]);
  assert.deepEqual(steps.map((s) => s.current), [true, false, false, false]);
});

test("computeWeekendTimeline: after answering, 'answered' becomes done and current", () => {
  const steps = computeWeekendTimeline({ answered: "AVAILABLE", selectionStarted: false, convoked: false, convokedTeamCode: null });
  assert.deepEqual(steps.map((s) => s.done), [true, true, false, false]);
  assert.equal(steps[1].current, true);
  assert.match(steps[1].title, /disponible/);
});

test("computeWeekendTimeline: an UNAVAILABLE answer is reflected in the title", () => {
  const steps = computeWeekendTimeline({ answered: "UNAVAILABLE", selectionStarted: false, convoked: false, convokedTeamCode: null });
  assert.match(steps[1].title, /indisponible/);
});

test("computeWeekendTimeline: selection in progress moves current forward", () => {
  const steps = computeWeekendTimeline({ answered: "AVAILABLE", selectionStarted: true, convoked: false, convokedTeamCode: null });
  assert.deepEqual(steps.map((s) => s.done), [true, true, true, false]);
  assert.equal(steps[2].current, true);
});

test("computeWeekendTimeline: once convoked, the last step shows the team code and is current", () => {
  const steps = computeWeekendTimeline({ answered: "AVAILABLE", selectionStarted: true, convoked: true, convokedTeamCode: "U13B" });
  assert.deepEqual(steps.map((s) => s.done), [true, true, true, true]);
  assert.equal(steps[3].current, true);
  assert.equal(steps[3].title, "Convoqué en U13B");
});

test("computeWeekendTimeline: convoked without a resolved team code falls back to a generic title", () => {
  const steps = computeWeekendTimeline({ answered: "AVAILABLE", selectionStarted: true, convoked: true, convokedTeamCode: null });
  assert.equal(steps[3].title, "Convocation");
});
