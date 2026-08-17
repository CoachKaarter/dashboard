import { test } from "node:test";
import assert from "node:assert/strict";
import { parisDateAtTime, parisWeekStart, parisStartOfDay, parisCalendarDate } from "./timezone";

test("parisDateAtTime: 14h00 Paris in winter (UTC+1)", () => {
  const day = new Date(Date.UTC(2026, 0, 15, 0, 0, 0)); // 15 janvier
  const d = parisDateAtTime(day, 14, 0);
  assert.equal(d.toISOString(), "2026-01-15T13:00:00.000Z");
});

test("parisDateAtTime: 14h00 Paris in summer (UTC+2, DST)", () => {
  const day = new Date(Date.UTC(2026, 7, 22, 0, 0, 0)); // 22 août
  const d = parisDateAtTime(day, 14, 0);
  assert.equal(d.toISOString(), "2026-08-22T12:00:00.000Z");
});

test("parisWeekStart: any weekday resolves to the same Monday", () => {
  const wednesday = new Date(Date.UTC(2026, 7, 19, 10, 0, 0)); // mercredi 19 août
  const start = parisWeekStart(wednesday);
  const { year, month, day } = parisCalendarDate(start);
  assert.deepEqual({ year, month, day }, { year: 2026, month: 8, day: 17 }); // lundi 17 août
});

test("parisWeekStart: Sunday belongs to the previous Monday's week", () => {
  // 12h00 UTC = 14h00 Paris (été) le dimanche 23 août — encore dimanche à Paris.
  const sunday = new Date(Date.UTC(2026, 7, 23, 12, 0, 0));
  const start = parisWeekStart(sunday);
  const { year, month, day } = parisCalendarDate(start);
  assert.deepEqual({ year, month, day }, { year: 2026, month: 8, day: 17 });
});

// Regression guard: Match.date/TrainingSession.date/CalendarEvent.date are
// created elsewhere in the app as `new Date("YYYY-MM-DD")`, i.e. plain UTC
// midnight of that calendar date. Any "day identity" value produced here
// (weekStartDate, eventDate, weekendDate…) must land on that exact same
// instant, in both winter and summer, or exact-equality Prisma lookups
// between the two systems (e.g. linking a WeekendAssignment to its Match)
// silently never match.
test("parisStartOfDay/parisWeekStart return UTC-midnight day-keys, matching the new Date(\"YYYY-MM-DD\") convention used for Match/TrainingSession dates — summer", () => {
  const midAugust = new Date(Date.UTC(2026, 7, 19, 10, 0, 0)); // mercredi 19 août, 10h UTC
  assert.equal(parisStartOfDay(midAugust).toISOString(), new Date("2026-08-19").toISOString());
  assert.equal(parisWeekStart(midAugust).toISOString(), new Date("2026-08-17").toISOString());
});

test("parisStartOfDay/parisWeekStart return UTC-midnight day-keys — winter", () => {
  const midJanuary = new Date(Date.UTC(2026, 0, 15, 10, 0, 0)); // jeudi 15 janvier, 10h UTC
  assert.equal(parisStartOfDay(midJanuary).toISOString(), new Date("2026-01-15").toISOString());
  assert.equal(parisWeekStart(midJanuary).toISOString(), new Date("2026-01-12").toISOString());
});
