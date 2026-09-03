import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, teamScopeWhere } from "@/lib/authz";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const user = await requireUser();
  const players = await prisma.player.findMany({
    where: { ...teamScopeWhere(user), archived: false },
    include: { team: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const csv = toCsv(
    ["Nom", "Prénom", "Équipe", "Catégorie", "Année de naissance", "Poste", "Pied fort", "Statut", "Arrivée au club"],
    players.map((p) => [p.lastName, p.firstName, p.team.code, p.team.category, p.birthYear, p.position, p.foot, p.status, p.joinedLabel])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="joueurs.csv"`,
    },
  });
}
