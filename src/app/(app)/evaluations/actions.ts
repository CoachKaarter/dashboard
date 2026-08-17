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

  await prisma.evaluationScore.upsert({
    where: { playerId_period: { playerId, period } },
    update: { technique, tactique, physique, comportement, evaluatorId: user.id },
    create: { playerId, period, technique, tactique, physique, comportement, evaluatorId: user.id },
  });
  revalidatePath("/evaluations");
  revalidatePath(`/joueurs/${playerId}`);
  revalidatePath("/");
}
