import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

// Full data export (admin-only) — a manual, app-level complement to
// Supabase's own infrastructure backups, not a replacement for them.
export async function GET() {
  await requireAdmin();

  const [
    users,
    teams,
    players,
    playerNotes,
    teamHistory,
    recurringSlots,
    trainingSessions,
    attendances,
    matches,
    matchConvocations,
    compositionSlots,
    matchPlayerStats,
    evaluationScores,
    equipment,
    equipmentAssignments,
    calendarEvents,
    unavailabilities,
    settings,
  ] = await Promise.all([
    prisma.user.findMany({ omit: { passwordHash: true } }),
    prisma.team.findMany(),
    prisma.player.findMany(),
    prisma.playerNote.findMany(),
    prisma.teamHistoryEntry.findMany(),
    prisma.recurringSlot.findMany(),
    prisma.trainingSession.findMany(),
    prisma.attendance.findMany(),
    prisma.match.findMany(),
    prisma.matchConvocation.findMany(),
    prisma.compositionSlot.findMany(),
    prisma.matchPlayerStat.findMany(),
    prisma.evaluationScore.findMany(),
    prisma.equipment.findMany(),
    prisma.equipmentAssignment.findMany(),
    prisma.calendarEvent.findMany(),
    prisma.unavailability.findMany(),
    prisma.settings.findMany(),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    users,
    teams,
    players,
    playerNotes,
    teamHistory,
    recurringSlots,
    trainingSessions,
    attendances,
    matches,
    matchConvocations,
    compositionSlots,
    matchPlayerStats,
    evaluationScores,
    equipment,
    equipmentAssignments,
    calendarEvents,
    unavailabilities,
    settings,
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sauvegarde-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
