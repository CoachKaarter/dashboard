"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { POSITIONS } from "@/lib/constants";
import { parseCsv } from "@/lib/csv";
import { logActivity } from "@/lib/activity";

export async function createPlayer(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get("teamId") ?? "");
  if (!canAccessTeam(user, teamId)) return;

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const birthYear = Number(formData.get("birthYear"));
  const position = String(formData.get("position") ?? "Non renseigné");
  if (!firstName || !lastName || !birthYear || !teamId) return;

  const player = await prisma.player.create({
    data: {
      firstName,
      lastName: lastName.toUpperCase(),
      birthYear,
      teamId,
      position: POSITIONS.includes(position) ? position : "Non renseigné",
      positionAlt: "Non renseigné",
      foot: "Non renseigné",
      status: "Actif",
      joinedLabel: String(formData.get("joinedLabel") ?? "").trim() || "Saison 2026/2027",
    },
  });
  await prisma.teamHistoryEntry.create({
    data: {
      playerId: player.id,
      toTeamId: teamId,
      date: new Date(),
      reason: "Arrivée au club",
      decidedById: user.id,
    },
  });
  revalidatePath("/joueurs");
  redirect(`/joueurs/${player.id}`);
}

// Expected columns (header row, case-insensitive, order-independent):
// Nom, Prénom, Équipe (code d'équipe, ex. "U13A") — le reste est optionnel.
export async function importPlayers(formData: FormData) {
  const user = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/joueurs/importer?error=Aucun+fichier");

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) redirect("/joueurs/importer?error=Fichier+vide+ou+illisible");

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const iNom = col("nom");
  const iPrenom = col("prénom", "prenom");
  const iEquipe = col("équipe", "equipe");
  const iCategorie = col("catégorie", "categorie");
  const iAnnee = col("année de naissance", "annee de naissance");
  const iPoste = col("poste");
  if (iNom < 0 || iPrenom < 0 || iEquipe < 0) {
    redirect("/joueurs/importer?error=Colonnes+attendues+%3A+Nom%2C+Pr%C3%A9nom%2C+%C3%89quipe");
  }

  const teams = await prisma.team.findMany();
  const teamByCode = new Map(teams.map((t) => [t.code.toUpperCase(), t]));

  let imported = 0;
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const lastName = (r[iNom] ?? "").trim();
    const firstName = (r[iPrenom] ?? "").trim();
    const teamCode = (r[iEquipe] ?? "").trim().toUpperCase();
    const team = teamByCode.get(teamCode);
    if (!lastName || !firstName || !team || !canAccessTeam(user, team.id)) {
      skipped++;
      continue;
    }
    const position = iPoste >= 0 && POSITIONS.includes(r[iPoste]?.trim()) ? r[iPoste].trim() : "Non renseigné";
    const birthYear = iAnnee >= 0 ? Number(r[iAnnee]) || (team.category === "U13" ? 2014 : 2015) : team.category === "U13" ? 2014 : 2015;

    const player = await prisma.player.create({
      data: {
        firstName,
        lastName: lastName.toUpperCase(),
        birthYear,
        teamId: team.id,
        position,
        positionAlt: "Non renseigné",
        foot: "Non renseigné",
        status: "Actif",
        joinedLabel: "Saison 2026/2027",
      },
    });
    await prisma.teamHistoryEntry.create({
      data: { playerId: player.id, toTeamId: team.id, date: new Date(), reason: "Import CSV", decidedById: user.id },
    });
    imported++;
    void iCategorie; // catégorie déduite de l'équipe ; colonne acceptée mais non utilisée
  }

  await logActivity({ actorId: user.id, summary: `a importé ${imported} joueur(s) via CSV (${skipped} ignoré(s))`, entityType: "Player" });
  revalidatePath("/joueurs");
  redirect(`/joueurs/importer?imported=${imported}&skipped=${skipped}`);
}
