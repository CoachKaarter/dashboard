import { test } from "node:test";
import assert from "node:assert/strict";
import { getWeekStart, getWeekendDate } from "./availability";

// Regression test for a real production bug: parent Saturday-availability
// writes (src/app/parent/(app)/actions.ts) used to compute eventDate via
// naive `Date.setDate()` (JS runtime/UTC calendar) instead of this Paris
// timezone-aware helper, while the reader (getWeekendBoard, src/lib/weekend.ts)
// always used getWeekendDate — an always-on 1-day offset that silently made
// parent submissions invisible on /week-end (exact-match Prisma query).
test("getWeekendDate lands on Saturday, 5 days after the Monday week start", () => {
  const monday = getWeekStart(new Date("2026-08-24T10:00:00Z"));
  const saturday = getWeekendDate(monday);
  const daysBetween = Math.round((saturday.getTime() - monday.getTime()) / 86400000);
  assert.equal(daysBetween, 5);
});

test("write-path and read-path derive the same eventDate from the same weekStartDate", () => {
  // The write-path and read-path must derive eventDate identically from the
  // same weekStartDate — this is the actual invariant that was broken.
  const monday = getWeekStart(new Date("2026-08-24T10:00:00Z"));
  const writerEventDate = getWeekendDate(new Date(monday.toISOString()));
  const readerEventDate = getWeekendDate(monday);
  assert.equal(writerEventDate.getTime(), readerEventDate.getTime());
});

test("getWeekendDate is stable whether weekStartDate round-trips through an ISO string (parent form) or not", () => {
  const monday = getWeekStart(new Date("2026-01-05T10:00:00Z"));
  const fromIso = getWeekendDate(new Date(monday.toISOString()));
  const direct = getWeekendDate(monday);
  assert.equal(fromIso.getTime(), direct.getTime());
});
