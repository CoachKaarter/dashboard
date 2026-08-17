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

export function getWeekStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=dimanche..6=samedi
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
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
