import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDatabase, DEMO_PASSWORD } from "@/lib/seed-data";

// TEMPORARY one-time migration endpoint: wipes the demo dataset and reseeds
// with the club's real data. Requires ?key=<SEED_SECRET>&confirm=EFFACER_ET_RESEMER
// so it can't be triggered accidentally. Delete this route file once it has
// been run successfully — it is not meant to stay in production.
export async function GET(req: NextRequest) {
  const secret = process.env.SEED_SECRET;
  const key = req.nextUrl.searchParams.get("key");
  const confirm = req.nextUrl.searchParams.get("confirm");
  if (!secret || key !== secret || confirm !== "EFFACER_ET_RESEMER") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  try {
    await prisma.$transaction([
      prisma.matchPlayerStat.deleteMany(),
      prisma.compositionSlot.deleteMany(),
      prisma.matchConvocation.deleteMany(),
      prisma.match.deleteMany(),
      prisma.attendance.deleteMany(),
      prisma.trainingSession.deleteMany(),
      prisma.jersey.deleteMany(),
      prisma.calendarEvent.deleteMany(),
      prisma.evaluationScore.deleteMany(),
      prisma.playerNote.deleteMany(),
      prisma.alertTreated.deleteMany(),
      prisma.teamHistoryEntry.deleteMany(),
      prisma.player.deleteMany(),
      prisma.team.deleteMany(),
    ]);

    const result = await seedDatabase(prisma);
    return NextResponse.json({
      reseeded: true,
      message: `Base réinitialisée avec les vraies données : ${result.players} joueurs, ${result.teams} équipes. Comptes staff inchangés (mot de passe "${DEMO_PASSWORD}" si non modifié).`,
    });
  } catch (e) {
    return NextResponse.json(
      { reseeded: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
