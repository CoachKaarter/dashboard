import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, getAccessibleCategories, canManageCategory } from "@/lib/authz";
import { toCsv } from "@/lib/csv";

// §25 : "Exporter les contacts manquants" — même périmètre que la page
// Accès familles (ADMIN, ou Responsable sur les catégories qu'il gère).
export async function GET() {
  const user = await requireUser();
  const manageableCategories = user.role === "ADMIN" ? null : getAccessibleCategories(user).filter((c) => canManageCategory(user, c));
  if (manageableCategories !== null && manageableCategories.length === 0) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const players = await prisma.player.findMany({
    where: {
      archived: false,
      parentEmail: null,
      ...(manageableCategories !== null ? { team: { category: { in: manageableCategories } } } : {}),
    },
    include: { team: true },
    orderBy: [{ team: { code: "asc" } }, { lastName: "asc" }],
  });

  const csv = toCsv(
    ["Nom", "Prénom", "Équipe", "Catégorie", "Nom du parent", "Téléphone"],
    players.map((p) => [p.lastName, p.firstName, p.team.code, p.team.category, p.parentName ?? "", p.parentPhone ?? ""])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contacts-familles-manquants.csv"',
    },
  });
}
