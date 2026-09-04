"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canAccessCategory } from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { interviewTypeSchema, objectiveCategorySchema, objectiveStatusSchema } from "@/lib/interview-validation";
import { revalidatePath } from "next/cache";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

async function requirePlayerAccess(playerId: string) {
  const user = await requireUser();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!canAccessCategory(user, player.category)) throw new Error("Accès non autorisé à ce joueur.");
  return { user, player };
}

export async function createInterview(playerId: string, formData: FormData) {
  const { user, player } = await requirePlayerAccess(playerId);

  const type = interviewTypeSchema.safeParse(formData.get("type"));
  if (!type.success) return;
  const dateRaw = str(formData, "date");
  const date = dateRaw ? new Date(dateRaw) : new Date();
  const nextReviewDateRaw = str(formData, "nextReviewDate");

  const interview = await prisma.playerInterview.create({
    data: {
      playerId,
      authorId: user.id,
      date,
      type: type.data,
      playerFeeling: str(formData, "playerFeeling"),
      playerFeedback: str(formData, "playerFeedback"),
      playerExpectations: str(formData, "playerExpectations"),
      playerDifficulties: str(formData, "playerDifficulties"),
      coachFeedback: str(formData, "coachFeedback"),
      strengths: str(formData, "strengths"),
      developmentAreas: str(formData, "developmentAreas"),
      agreedSummary: str(formData, "agreedSummary"),
      privateNotes: str(formData, "privateNotes"),
      nextReviewDate: nextReviewDateRaw ? new Date(nextReviewDateRaw) : null,
    },
  });

  // Jusqu'à 3 objectifs décidés ensemble peuvent être créés directement
  // depuis le formulaire d'entretien — jamais publiés automatiquement.
  for (let i = 0; i < 3; i++) {
    const title = str(formData, `objectiveTitle${i}`);
    if (!title) continue;
    const category = objectiveCategorySchema.safeParse(formData.get(`objectiveCategory${i}`));
    if (!category.success) continue;
    const targetDateRaw = str(formData, `objectiveTargetDate${i}`);
    await prisma.playerObjective.create({
      data: {
        playerId,
        createdFromInterviewId: interview.id,
        title,
        category: category.data,
        targetDate: targetDateRaw ? new Date(targetDateRaw) : null,
        createdById: user.id,
      },
    });
  }

  await logActivity({
    actorId: user.id,
    summary: `a réalisé un entretien (${type.data}) avec ${player.firstName} ${player.lastName}`,
    entityType: "Player",
    entityId: playerId,
  });
  revalidatePath(`/joueurs/${playerId}`);
}

export async function updateObjectiveStatus(playerId: string, objectiveId: string, formData: FormData) {
  const { user, player } = await requirePlayerAccess(playerId);
  const status = objectiveStatusSchema.safeParse(formData.get("status"));
  if (!status.success) return;
  const comment = str(formData, "comment");

  const objective = await prisma.playerObjective.findUniqueOrThrow({ where: { id: objectiveId } });
  if (objective.playerId !== playerId) return;

  await prisma.playerObjective.update({
    where: { id: objectiveId },
    data: {
      status: status.data,
      completedAt: status.data === "ACQUIS" || status.data === "ABANDONNE" ? new Date() : null,
    },
  });
  if (comment) {
    await prisma.playerObjectiveUpdate.create({ data: { objectiveId, comment } });
  }
  await logActivity({
    actorId: user.id,
    summary: `a mis à jour l'objectif « ${objective.title} » (${status.data}) de ${player.firstName} ${player.lastName}`,
    entityType: "Player",
    entityId: playerId,
  });
  revalidatePath(`/joueurs/${playerId}`);
}

export async function toggleObjectiveVisibility(playerId: string, objectiveId: string, visible: boolean) {
  const { user, player } = await requirePlayerAccess(playerId);
  const objective = await prisma.playerObjective.findUniqueOrThrow({ where: { id: objectiveId } });
  if (objective.playerId !== playerId) return;

  await prisma.playerObjective.update({ where: { id: objectiveId }, data: { visibleToPlayer: visible } });
  await logActivity({
    actorId: user.id,
    summary: `a ${visible ? "publié" : "dépublié"} l'objectif « ${objective.title} » côté espace joueur pour ${player.firstName} ${player.lastName}`,
    entityType: "Player",
    entityId: playerId,
  });
  revalidatePath(`/joueurs/${playerId}`);
}
