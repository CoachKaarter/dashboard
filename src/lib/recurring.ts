import { prisma } from "@/lib/prisma";

const WEEKS_AHEAD = 6;

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function nextWeekday(base: Date, weekday: number, weeksAhead: number) {
  const diff = (weekday - base.getDay() + 7) % 7;
  return addDays(base, diff + weeksAhead * 7);
}

/**
 * Creates upcoming TrainingSession rows from active RecurringSlot templates,
 * for the next WEEKS_AHEAD weeks. Idempotent: skips a (date, category,
 * scopeTeam, startTime) combination that already has a session, whether or
 * not that row came from this generator — so editing/cancelling a generated
 * session (an "exception") never gets silently recreated.
 */
export async function ensureUpcomingSessions() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = addDays(today, WEEKS_AHEAD * 7);

  const [slots, existing] = await Promise.all([
    prisma.recurringSlot.findMany({ where: { active: true } }),
    prisma.trainingSession.findMany({
      where: { date: { gte: today, lte: horizon } },
      select: { date: true, category: true, scopeTeamId: true, startTime: true },
    }),
  ]);
  if (slots.length === 0) return;

  const existingKeys = new Set(
    existing.map((s) => `${s.date.toISOString().slice(0, 10)}|${s.category}|${s.scopeTeamId ?? ""}|${s.startTime}`)
  );

  const toCreate: {
    date: Date;
    startTime: string;
    endTime: string;
    location: string;
    status: string;
    category: string;
    scopeTeamId: string | null;
    label: string;
    sourceSlotId: string;
  }[] = [];

  for (const slot of slots) {
    for (let week = 0; week < WEEKS_AHEAD; week++) {
      const date = nextWeekday(today, slot.weekday, week);
      const key = `${date.toISOString().slice(0, 10)}|${slot.category}|${slot.scopeTeamId ?? ""}|${slot.startTime}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      toCreate.push({
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        location: slot.location,
        status: "Prévue",
        category: slot.category,
        scopeTeamId: slot.scopeTeamId,
        label: slot.label,
        sourceSlotId: slot.id,
      });
    }
  }
  if (toCreate.length === 0) return;
  await prisma.trainingSession.createMany({ data: toCreate });
}
