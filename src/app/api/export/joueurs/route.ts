import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds, getAccessibleCategories } from "@/lib/authz";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  // A player with no fixed team (Player.teamId null) is still in scope
  // whenever their category is.
  const players = await prisma.player.findMany({
    where: { ...(scope === "ALL" ? {} : { category: { in: getAccessibleCategories(user) } }), archived: false },
    include: { team: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const csv = toCsv(
    ["Nom", "Prénom", "Équipe", "Catégorie", "Année de naissance", "Poste", "Pied fort", "Statut", "Arrivée au club"],
    players.map((p) => [p.lastName, p.firstName, p.team?.code ?? "", p.category, p.birthYear, p.position, p.foot, p.status, p.joinedLabel])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="joueurs.csv"`,
    },
  });
}
