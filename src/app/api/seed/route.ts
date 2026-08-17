import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDatabase, DEMO_PASSWORD } from "@/lib/seed-data";

// One-time setup endpoint: visit this URL once after the first deploy to
// populate the database with demo data. Requires ?key=<SEED_SECRET> so it
// can't be triggered (or its demo credentials read) by anyone who finds the
// URL. Safe to call more than once — it only seeds when the database is
// empty, and never deletes anything.
export async function GET(req: NextRequest) {
  const secret = process.env.SEED_SECRET;
  const key = req.nextUrl.searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  try {
    const existing = await prisma.user.count();
    if (existing > 0) {
      return NextResponse.json({
        seeded: false,
        message: "La base de données contient déjà des comptes — rien n'a été modifié.",
      });
    }

    const result = await seedDatabase(prisma);
    return NextResponse.json({
      seeded: true,
      message: `Base de données initialisée : ${result.players} joueurs, ${result.teams} équipes. Connecte-toi avec l'identifiant "marvyn" et le mot de passe "${DEMO_PASSWORD}".`,
    });
  } catch (e) {
    return NextResponse.json(
      {
        seeded: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
