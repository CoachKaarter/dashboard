/**
 * Every business time in this app (availability windows, pre/post-séance
 * questionnaires, training sessions, matches) is meant in Europe/Paris wall
 * time. A plain `new Date()` / `setHours()` is silently wrong on Vercel,
 * whose servers run in UTC — "14:00" would actually land at 14:00 UTC
 * (16:00 Paris in summer). This file is the one place that does the
 * UTC↔Paris conversion, via Intl (no date library dependency).
 */
const PARIS_TZ = "Europe/Paris";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PARIS_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parisParts(date: Date) {
  const parts = partsFormatter.formatToParts(date).reduce(
    (acc, p) => {
      if (p.type !== "literal") acc[p.type] = Number(p.value);
      return acc;
    },
    {} as Record<string, number>
  );
  return parts as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** UTC-minus-Paris offset in minutes at the given instant (handles DST). */
function parisOffsetMinutes(date: Date): number {
  const p = parisParts(date);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** The (year, month, day) calendar date this instant falls on, as seen in Paris. */
export function parisCalendarDate(date: Date) {
  const p = parisParts(date);
  return { year: p.year, month: p.month, day: p.day };
}

/**
 * Builds the precise UTC instant for a given Paris wall-clock date+time.
 * `dateForDay` only supplies which calendar day (in Paris) to use — its
 * own time-of-day is ignored.
 */
export function parisDateAtTime(dateForDay: Date, hour: number, minute = 0): Date {
  const { year, month, day } = parisCalendarDate(dateForDay);
  const rough = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = parisOffsetMinutes(rough);
  return new Date(rough.getTime() - offset * 60000);
}

/** Midnight (00:00) in Paris of the calendar day this instant falls on, as a UTC instant. */
export function parisStartOfDay(date: Date): Date {
  return parisDateAtTime(date, 0, 0);
}

/** Monday 00:00 Paris of the week containing this instant. */
export function parisWeekStart(date: Date): Date {
  const { year, month, day } = parisCalendarDate(date);
  const asLocalNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // safe from DST edge, just for getDay()
  const weekday = asLocalNoon.getUTCDay(); // 0=dimanche..6=samedi, matches Paris calendar day since we used noon
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  const mondayNoon = new Date(asLocalNoon.getTime() + diffToMonday * 86400000);
  return parisStartOfDay(mondayNoon);
}
