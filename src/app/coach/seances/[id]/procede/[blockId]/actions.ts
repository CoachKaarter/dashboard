"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession } from "@/lib/authz";
import { revalidatePath } from "next/cache";

async function assertAccess(sessionId: string) {
  const user = await requireUser();
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!(await canAccessSession(user, session))) throw new Error("Accès refusé.");
}

function revalidateAll(sessionId: string) {
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath(`/seances/${sessionId}`);
}

export async function startBlock(sessionId: string, blockId: string) {
  await assertAccess(sessionId);
  const block = await prisma.sessionBlock.findUniqueOrThrow({ where: { id: blockId } });
  if (block.startedAt) return; // already started — a second tap (or a second coach) must not reset the clock
  await prisma.sessionBlock.update({ where: { id: blockId }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
  revalidateAll(sessionId);
}

// actualDurationMinutes is the real active time tracked client-side
// (pauses excluded) — durationMinutes (prévue) is never touched.
export async function completeBlock(sessionId: string, blockId: string, actualDurationMinutes: number) {
  await assertAccess(sessionId);
  await prisma.sessionBlock.update({
    where: { id: blockId },
    data: { status: "DONE", endedAt: new Date(), actualDurationMinutes: Math.max(0, Math.round(actualDurationMinutes)) },
  });
  revalidateAll(sessionId);
}

export async function skipBlock(sessionId: string, blockId: string) {
  await assertAccess(sessionId);
  await prisma.sessionBlock.update({ where: { id: blockId }, data: { status: "SKIPPED", endedAt: new Date() } });
  revalidateAll(sessionId);
}
