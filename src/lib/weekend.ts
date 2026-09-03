/**
 * Répartition du week-end — where each player who declared themselves
 * available for Saturday actually plays. WeekendAssignment is a PONCTUAL
 * link (one Saturday) and never changes Player.teamId (the permanent
 * group). See prisma/schema.prisma for the "ne jamais fusionner" note
 * shared with PlayerAvailability/Attendance/MatchConvocation.
 */
import { prisma } from "@/lib/prisma";
import { getWeekendDate } from "@/lib/availability";
import { parisStartOfDay } from "@/lib/timezone";

export type Scope = string[] | "ALL";

export type GoalkeeperPosition = "Gardien";

export async function getWeekendBoard(weekStartDate: Date, scope: Scope) {
  const weekendDate = getWeekendDate(weekStartDate);
  const teamWhere = scope === "ALL" ? {} : { id: { in: scope } };

  const [teams, plan, window] = await Promise.all([
    prisma.team.findMany({ where: teamWhere, orderBy: { code: "asc" } }),
    prisma.weekendPlan.findUnique({ where: { weekStartDate } }),
    prisma.weeklyAvailabilityWindow.findUnique({ where: { weekStartDate } }),
  ]);
  const teamIds = teams.map((t) => t.id);

  const today = parisStartOfDay(new Date());
  const [matches, nextMatches, players, assignments, staffAssignments, availability, unavailAll] = await Promise.all([
    prisma.match.findMany({
      where: { teamId: { in: teamIds }, date: weekendDate, status: { not: "Annulé" } },
      orderBy: { time: "asc" },
    }),
    // Genuinely the next match on the calendar for each team — which is NOT
    // necessarily this Saturday's match above: a team can have a midweek
    // fixture before the weekend one, and staff need to see that, not the
    // weekend board's own Saturday slot mistaken for "the next match".
    prisma.match.findMany({
      where: { teamId: { in: teamIds }, date: { gte: today }, status: { not: "Annulé" } },
      orderBy: { date: "asc" },
    }),
    prisma.player.findMany({
      where: { archived: false, teamId: { in: teamIds } },
      include: { team: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.weekendAssignment.findMany({
      where: { weekendDate, teamId: { in: teamIds } },
      include: { player: { include: { team: true } } },
    }),
    prisma.matchStaffAssignment.findMany({
      where: { match: { teamId: { in: teamIds }, date: weekendDate } },
      include: { user: true },
    }),
    prisma.playerAvailability.findMany({
      where: { type: "WEEKEND", eventDate: weekendDate, player: { teamId: { in: teamIds } } },
    }),
    prisma.unavailability.findMany({
      where: {
        status: "VALIDATED",
        actualReturn: null,
        player: { teamId: { in: teamIds } },
        startDate: { lte: weekendDate },
      },
      select: { playerId: true },
    }),
  ]);

  const availByPlayer = new Map(availability.map((a) => [a.playerId, a]));
  const unavailablePlayerIds = new Set(unavailAll.map((u) => u.playerId));
  const assignedByPlayer = new Map(assignments.map((a) => [a.playerId, a]));

  const availablePlayers = players.filter(
    (p) => p.status === "Actif" && !unavailablePlayerIds.has(p.id) && availByPlayer.get(p.id)?.status === "AVAILABLE"
  );
  const unassignedAvailable = availablePlayers.filter((p) => !assignedByPlayer.has(p.id));
  const noResponseCount = players.filter((p) => p.status === "Actif" && !unavailablePlayerIds.has(p.id) && !availByPlayer.has(p.id)).length;
  const unavailableCount = players.filter((p) => availByPlayer.get(p.id)?.status === "UNAVAILABLE" || unavailablePlayerIds.has(p.id)).length;

  // Anomalie : un joueur affecté alors qu'il s'est déclaré indisponible ou
  // qu'il a une indisponibilité longue validée (le staff a pu affecter avant
  // la réponse, ou la déclaration est arrivée après coup) — jamais bloquant,
  // seulement signalé avant validation.
  const assignedButUnavailable = assignments.filter(
    (a) => unavailablePlayerIds.has(a.playerId) || availByPlayer.get(a.playerId)?.status === "UNAVAILABLE"
  );

  const teamCards = teams.map((t) => {
    const match = matches.find((m) => m.teamId === t.id) ?? null;
    // nextMatches is ordered by date ascending, so the first hit per team is
    // its earliest upcoming match — .find() short-circuits there.
    const nextMatch = nextMatches.find((m) => m.teamId === t.id) ?? null;
    const assigned = assignments.filter((a) => a.teamId === t.id);
    const keeper = assigned.find((a) => a.player.position === "Gardien");
    const staff = staffAssignments.filter((s) => match && s.matchId === match.id);
    const needed = match?.needed ?? (t.category === "U13" ? 12 : 11);
    return { team: t, match, nextMatch, assigned, keeper, staff, needed };
  });

  return {
    weekendDate,
    plan,
    window,
    teamCards,
    unassignedAvailable,
    assignedButUnavailable,
    counts: {
      totalPlayers: players.length,
      available: availablePlayers.length,
      unavailable: unavailableCount,
      noResponse: noResponseCount,
      assigned: assignments.length,
      unassigned: unassignedAvailable.length,
      matchesConfirmed: matches.filter((m) => m.opponent).length,
      matchesTotal: teams.length,
      placesNeeded: teamCards.reduce((n, c) => n + c.needed, 0),
    },
  };
}
