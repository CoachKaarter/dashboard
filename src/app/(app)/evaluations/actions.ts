"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function upsertEvaluation(playerId: string, period: string, formData: FormData) {
  const session = await auth();
  const clamp = (v: number) => Math.max(1, Math.min(5, v));
  const technique = clamp(Number(formData.get("technique")));
  const tactique = clamp(Number(formData.get("tactique")));
  const physique = clamp(Number(formData.get("physique")));
  const comportement = clamp(Number(formData.get("comportement")));

  await prisma.evaluationScore.upsert({
    where: { playerId_period: { playerId, period } },
    update: { technique, tactique, physique, comportement, evaluatorId: session?.user?.id },
    create: { playerId, period, technique, tactique, physique, comportement, evaluatorId: session?.user?.id },
  });
  revalidatePath("/evaluations");
  revalidatePath(`/joueurs/${playerId}`);
  revalidatePath("/");
}
