"use server";

import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/parent-session";
import { notifyTeamStaff, notifyCategoryStaff } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { redirect } from "next/navigation";

const TYPES = ["Blessure", "Maladie", "Absence longue", "Autre"];

export async function declareUnavailabilityByParent(formData: FormData) {
  const parent = await requireParent();
  const type = String(formData.get("type") ?? "");
  if (!TYPES.includes(type)) return;

  const description = String(formData.get("description") || "").trim() || null;
  const startDateRaw = String(formData.get("startDate") || "");
  const startDate = startDateRaw ? new Date(startDateRaw) : new Date();
  const expectedReturnRaw = String(formData.get("expectedReturn") || "");
  const expectedReturn = expectedReturnRaw ? new Date(expectedReturnRaw) : null;

  await prisma.unavailability.create({
    data: {
      playerId: parent.activePlayerId,
      type,
      description,
      startDate,
      expectedReturn,
      source: "PARENT",
      status: "PENDING",
    },
  });

  await logActivity({
    actorId: null,
    summary: `La famille de ${parent.activePlayer.firstName} ${parent.activePlayer.lastName} a déclaré une indisponibilité (${type}) — en attente de validation`,
    entityType: "Player",
    entityId: parent.activePlayerId,
  });

  const notifyPayload = {
    type: "unavailability-declared",
    title: `${parent.activePlayer.firstName} ${parent.activePlayer.lastName} — nouvelle indisponibilité déclarée`,
    body: `${type} — à valider`,
    href: `/joueurs/${parent.activePlayerId}`,
  };
  if (parent.activePlayer.teamId) {
    await notifyTeamStaff(parent.activePlayer.teamId, notifyPayload);
  } else {
    await notifyCategoryStaff(parent.activePlayer.teamCategory, notifyPayload);
  }

  redirect("/parent/profil?declared=1");
}
