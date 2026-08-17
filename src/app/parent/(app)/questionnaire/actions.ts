"use server";

import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/parent-session";
import { isPreOpen, isPostOpen, computeLoad } from "@/lib/session-feedback";
import { revalidatePath } from "next/cache";

export async function submitPreFeedback(sessionId: string, formData: FormData) {
  const parent = await requireParent();
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session || !isPreOpen(session)) return;

  const preFeeling = Number(formData.get("preFeeling"));
  const fatigue = String(formData.get("fatigue") || "") || null;
  const painRaw = String(formData.get("pain") || "");
  const pain = painRaw === "oui" ? true : painRaw === "non" ? false : null;
  const painLocation = pain ? String(formData.get("painLocation") || "").trim() || null : null;

  await prisma.sessionFeedback.upsert({
    where: { sessionId_playerId: { sessionId, playerId: parent.playerId } },
    update: { preFeeling: preFeeling || null, fatigue, pain, painLocation, preAnsweredAt: new Date() },
    create: { sessionId, playerId: parent.playerId, preFeeling: preFeeling || null, fatigue, pain, painLocation, preAnsweredAt: new Date() },
  });
  revalidatePath("/parent");
}

export async function submitPostFeedback(sessionId: string, formData: FormData) {
  const parent = await requireParent();
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session || !isPostOpen(session)) return;

  const postFeeling = Number(formData.get("postFeeling")) || null;
  const rpe = Number(formData.get("rpe")) || null;
  const enjoyment = Number(formData.get("enjoyment")) || null;
  const comment = String(formData.get("comment") || "").trim() || null;
  const calculatedLoad = rpe ? computeLoad(session, rpe) : null;

  await prisma.sessionFeedback.upsert({
    where: { sessionId_playerId: { sessionId, playerId: parent.playerId } },
    update: { postFeeling, rpe, enjoyment, comment, calculatedLoad, postAnsweredAt: new Date() },
    create: { sessionId, playerId: parent.playerId, postFeeling, rpe, enjoyment, comment, calculatedLoad, postAnsweredAt: new Date() },
  });
  revalidatePath("/parent");
}
