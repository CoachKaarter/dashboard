"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function upsertEvaluation(playerId: string, period: string, formData: FormData) {
  const user = await requireUser();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
  if (!canAccessTeam(user, player.teamId)) return;

  const clamp = (v: number) => Math.max(1, Math.min(5, v));
  const technique = clamp(Number(formData.get("technique")));
  const tactique = clamp(Number(formData.get("tactique")));
  const physique = clamp(Number(formData.get("physique")));
  const comportement = clamp(Number(formData.get("comportement")));
  const objectives = String(formData.get("objectives") || "").trim() || null;

  await prisma.evaluationScore.upsert({
    where: { playerId_period: { playerId, period } },
    update: { technique, tactique, physique, comportement, objectives, evaluatorId: user.id },
    create: { playerId, period, technique, tactique, physique, comportement, objectives, evaluatorId: user.id },
  });
  revalidatePath("/evaluations");
  revalidatePath(`/joueurs/${playerId}`);
  revalidatePath("/");
}

export async function updateObjectives(evaluationId: string, formData: FormData) {
  const user = await requireUser();
  const evaluation = await prisma.evaluationScore.findUniqueOrThrow({ where: { id: evaluationId }, include: { player: true } });
  if (!canAccessTeam(user, evaluation.player.teamId)) return;

  const objectives = String(formData.get("objectives") || "").trim() || null;
  await prisma.evaluationScore.update({ where: { id: evaluationId }, data: { objectives } });
  revalidatePath(`/joueurs/${evaluation.playerId}`);
}
