import { prisma } from "@/lib/prisma";
import { getClub } from "@/lib/club";
import type { getWeekendBoard } from "@/lib/weekend";
import {
  buildConvocationPosterData,
  fallbackSeasonLabel,
  type ConvocationPosterData,
  type PosterMatchInput,
  type PosterPlayerInput,
} from "@/lib/convocation-poster";

const EDUCATEUR_ROLES = ["Coach", "Adjoint", "Entraîneur gardien"];
const APP_URL = process.env.APP_URL ?? "https://onzevo.website";

/**
 * Fetch orchestrator for the convocation poster — deliberately thin and
 * untested (like getWeekendBoard/getWeekendResults elsewhere): all the real
 * logic (ordering, fallbacks, anomaly detection) lives in the pure
 * buildConvocationPosterData, which this only feeds. Takes the SAME board
 * object /week-end already computed for the WhatsApp message and the
 * board itself — never a second, independently-scoped query — so the
 * poster can never show a team the viewer isn't actually authorized for.
 */
export async function fetchConvocationPosterData(
  board: Awaited<ReturnType<typeof getWeekendBoard>>
): Promise<ConvocationPosterData> {
  const teamIds = board.teamCards.map((c) => c.team.id);
  const matchIds = board.teamCards.filter((c) => c.match).map((c) => c.match!.id);

  const [club, season, convocations, jerseyAssignments, players] = await Promise.all([
    getClub(),
    prisma.season.findFirst({ where: { isCurrent: true }, select: { label: true } }),
    prisma.matchConvocation.findMany({ where: { matchId: { in: matchIds } }, include: { player: true } }),
    prisma.equipmentAssignment.findMany({
      where: { status: "CHEZ_LE_JOUEUR", equipment: { category: "MAILLOTS", teamId: { in: teamIds } } },
      include: { equipment: true },
      orderBy: { issuedDate: "desc" },
    }),
    prisma.player.findMany({ where: { archived: false, teamId: { in: teamIds } } }),
  ]);

  const playerIds = players.map((p) => p.id);
  const [availability, longUnavailable] = await Promise.all([
    prisma.playerAvailability.findMany({
      where: { type: "WEEKEND", eventDate: board.weekendDate, playerId: { in: playerIds } },
    }),
    prisma.unavailability.findMany({
      where: { status: "VALIDATED", actualReturn: null, playerId: { in: playerIds }, startDate: { lte: board.weekendDate } },
      select: { playerId: true },
    }),
  ]);

  const convocsByMatch = new Map<string, typeof convocations>();
  for (const c of convocations) {
    if (!convocsByMatch.has(c.matchId)) convocsByMatch.set(c.matchId, []);
    convocsByMatch.get(c.matchId)!.push(c);
  }
  const jerseyByTeamId = new Map<string, (typeof jerseyAssignments)[number]>();
  for (const a of jerseyAssignments) {
    if (a.equipment.teamId && !jerseyByTeamId.has(a.equipment.teamId)) jerseyByTeamId.set(a.equipment.teamId, a);
  }
  const convokedPlayerIds = new Set(convocations.map((c) => c.playerId));
  const availByPlayer = new Map(availability.map((a) => [a.playerId, a]));
  const longUnavailableIds = new Set(longUnavailable.map((u) => u.playerId));

  const toPlayerInput = (p: { id: string; firstName: string; lastName: string }): PosterPlayerInput => ({
    playerId: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
  });

  const blesses = players.filter((p) => p.status === "Blessé");
  const blessedIds = new Set(blesses.map((p) => p.id));
  const absents = players.filter(
    (p) => !blessedIds.has(p.id) && (availByPlayer.get(p.id)?.status === "UNAVAILABLE" || longUnavailableIds.has(p.id))
  );
  const absentIds = new Set(absents.map((p) => p.id));
  const nonConvoques = players.filter(
    (p) => p.status === "Actif" && !blessedIds.has(p.id) && !absentIds.has(p.id) && !convokedPlayerIds.has(p.id)
  );

  const matchesByTeamId = new Map<string, PosterMatchInput>();
  for (const c of board.teamCards) {
    if (!c.match) continue;
    const convocs = convocsByMatch.get(c.match.id) ?? [];
    const educateurs = c.staff.filter((s) => EDUCATEUR_ROLES.includes(s.role)).map((s) => s.user.name);
    const dirigeants = c.staff.filter((s) => s.role === "Dirigeant").map((s) => s.user.name);
    const phone = c.staff.find((s) => EDUCATEUR_ROLES.includes(s.role) && s.user.phone)?.user.phone ?? null;
    const jersey = jerseyByTeamId.get(c.team.id);

    matchesByTeamId.set(c.team.id, {
      matchId: c.match.id,
      teamId: c.team.id,
      date: c.match.date,
      competition: c.match.competition,
      opponent: c.match.opponent,
      isHome: c.match.isHome,
      location: c.match.location,
      surface: c.match.surface,
      venueAddress: c.match.venueAddress,
      time: c.match.time,
      meetTime: c.match.meetTime,
      meetLocation: c.match.meetLocation,
      estimatedEndTime: c.match.estimatedEndTime,
      estimatedReturnTime: c.match.estimatedReturnTime,
      parentNotes: c.match.parentNotes,
      transportMode: c.match.transportMode,
      players: convocs.map((mc) => toPlayerInput(mc.player)),
      educateurs,
      phone,
      dirigeants,
      jerseyHolder: jersey ? { name: jersey.responsibleLabel, dueDate: jersey.dueDate } : null,
    });
  }

  return buildConvocationPosterData({
    clubName: club.name,
    clubShortName: club.shortName,
    seasonLabel: season?.label ?? fallbackSeasonLabel(new Date()),
    clubLogoUrl: club.hasLogo ? `${APP_URL}/api/club/logo?v=${club.logoVersion}` : null,
    teams: board.teamCards.map((c) => ({ teamId: c.team.id, code: c.team.code, category: c.team.category, level: c.team.level })),
    matchesByTeamId,
    sideLists: {
      blesses: blesses.map(toPlayerInput),
      absents: absents.map(toPlayerInput),
      nonConvoques: nonConvoques.map(toPlayerInput),
    },
  });
}
