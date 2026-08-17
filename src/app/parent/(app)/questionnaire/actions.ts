"use server";

import { prisma } from "@/lib/prisma";
import { requireParent, type AuthedParent } from "@/lib/parent-session";
import { isPreOpen, isPostOpen, computeLoad } from "@/lib/session-feedback";
import { preFeelingSchema, postFeelingSchema, rpeSchema, enjoymentSchema, fatigueSchema, painSchema } from "@/lib/parent-validation";
import { revalidatePath } from "next/cache";
import type { TrainingSession } from "@/generated/prisma/client";

function sessionInParentScope(session: TrainingSession, parent: AuthedParent) {
  if (session.scopeTeamId) return session.scopeTeamId === parent.player.teamId;
  return session.category === parent.player.teamCategory;
}

export async function submitPreFeedback(sessionId: string, formData: FormData) {
  const parent = await requireParent();
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session || !sessionInParentScope(session, parent) || !isPreOpen(session)) return;

  const feelingParsed = preFeelingSchema.safeParse(formData.get("preFeeling"));
  const fatigueParsed = fatigueSchema.safeParse(formData.get("fatigue"));
  const painParsed = painSchema.safeParse(formData.get("pain"));
  const pain = painParsed.success ? painParsed.data === "oui" : null;
  const painLocation = pain ? String(formData.get("painLocation") || "").trim() || null : null;

  const data = {
    preFeeling: feelingParsed.success ? feelingParsed.data : null,
    fatigue: fatigueParsed.success ? fatigueParsed.data : null,
    pain,
    painLocation,
    preAnsweredAt: new Date(),
  };
  await prisma.sessionFeedback.upsert({
    where: { sessionId_playerId: { sessionId, playerId: parent.playerId } },
    update: data,
    create: { sessionId, playerId: parent.playerId, ...data },
  });
  revalidatePath("/parent");
}

export async function submitPostFeedback(sessionId: string, formData: FormData) {
  const parent = await requireParent();
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session || !sessionInParentScope(session, parent) || !isPostOpen(session)) return;

  const postFeelingParsed = postFeelingSchema.safeParse(formData.get("postFeeling"));
  const rpeParsed = rpeSchema.safeParse(formData.get("rpe"));
  const enjoymentParsed = enjoymentSchema.safeParse(formData.get("enjoyment"));
  const comment = String(formData.get("comment") || "").trim() || null;
  const rpe = rpeParsed.success ? rpeParsed.data : null;
  const calculatedLoad = rpe ? computeLoad(session, rpe) : null;

  const data = {
    postFeeling: postFeelingParsed.success ? postFeelingParsed.data : null,
    rpe,
    enjoyment: enjoymentParsed.success ? enjoymentParsed.data : null,
    comment,
    calculatedLoad,
    postAnsweredAt: new Date(),
  };
  await prisma.sessionFeedback.upsert({
    where: { sessionId_playerId: { sessionId, playerId: parent.playerId } },
    update: data,
    create: { sessionId, playerId: parent.playerId, ...data },
  });
  revalidatePath("/parent");
}
