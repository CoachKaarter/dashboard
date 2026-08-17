"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { POSITIONS } from "@/lib/constants";

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
