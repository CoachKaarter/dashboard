/**
 * PlayerAvailability = disponibilité PRÉVISIONNELLE déclarée par la famille.
 * Trois autres concepts existent déjà dans le Cockpit et ne doivent JAMAIS
 * être fusionnés avec celui-ci :
 *   - Attendance        = présence RÉELLE, pointée par le coach (séances/actions.ts)
 *   - MatchConvocation   = décision OFFICIELLE du staff pour un match
 *   - Unavailability     = blessure / indisponibilité longue
 * Ce fichier ne touche à aucun des trois.
 */
import { prisma } from "@/lib/prisma";
import { parisWeekStart, parisStartOfDay } from "@/lib/timezone";

/** Monday 00:00 Europe/Paris of the week containing this instant. */
export function getWeekStart(date: Date) {
  return parisWeekStart(date);
}

/**
 * Adds N calendar days and re-normalizes to Paris midnight — a plain
 * +N*86400000ms would drift by an hour across a DST transition. Only
 * meaningful when `date` is already a Paris-midnight instant (as
 * getWeekStart/getWeekendDate return); for arbitrary instants this is day
 * arithmetic on the Paris calendar date, not a fixed duration.
 */
export function addDays(date: Date, days: number) {
  const rough = new Date(date.getTime() + days * 86400000);
  return parisStartOfDay(rough);
}

export function getWeekendDate(weekStartDate: Date) {
  return addDays(weekStartDate, 5); // samedi
}

/** Read-only — never creates a row. Absence of a window row means "jamais ouverte" (CLOSED). */
export async function getWindowForWeek(weekStartDate: Date) {
  return prisma.weeklyAvailabilityWindow.findUnique({ where: { weekStartDate } });
}

export async function getOrCreateWindowForWeek(weekStartDate: Date) {
  const existing = await getWindowForWeek(weekStartDate);
  if (existing) return existing;
  const weekEndDate = addDays(weekStartDate, 6);
  return prisma.weeklyAvailabilityWindow.create({ data: { weekStartDate, weekEndDate, status: "CLOSED" } });
}

/** Training sessions concerning one player's team/category within a Monday-to-Sunday week. */
export async function getPlayerWeekSessions(playerId: string, weekStartDate: Date) {
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId }, include: { team: true } });
  const weekEnd = addDays(weekStartDate, 7);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      date: { gte: weekStartDate, lt: weekEnd },
      status: { not: "Annulée" },
      OR: [{ scopeTeamId: player.teamId }, { scopeTeamId: null, category: player.team.category }],
    },
    orderBy: { date: "asc" },
  });
  return { player, sessions };
}

type UpsertInput = {
  playerId: string;
  type: "TRAINING" | "WEEKEND";
  sessionId?: string | null;
  eventDate: Date;
  weekStartDate: Date;
  status: "AVAILABLE" | "UNAVAILABLE";
  absenceReason?: string | null;
  comment?: string | null;
  answeredBy?: "PARENT" | "STAFF";
};

export async function upsertAvailability(input: UpsertInput) {
  const where =
    input.type === "TRAINING" && input.sessionId
      ? { playerId: input.playerId, sessionId: input.sessionId }
      : { playerId: input.playerId, type: "WEEKEND", eventDate: input.eventDate };

  const existing = await prisma.playerAvailability.findFirst({ where });
  const data = {
    status: input.status,
    absenceReason: input.absenceReason ?? null,
    comment: input.comment ?? null,
    answeredBy: input.answeredBy ?? "PARENT",
    answeredAt: new Date(),
  };
  if (existing) {
    return prisma.playerAvailability.update({ where: { id: existing.id }, data });
  }
  return prisma.playerAvailability.create({
    data: {
      playerId: input.playerId,
      type: input.type,
      sessionId: input.type === "TRAINING" ? input.sessionId ?? null : null,
      eventDate: input.eventDate,
      weekStartDate: input.weekStartDate,
      ...data,
    },
  });
}
