"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession } from "@/lib/authz";
import { assertBlockBelongsToSession } from "@/lib/session-scope";
import { ensureSessionInProgress } from "@/lib/session-lifecycle";
import { actualDurationMinutesSchema } from "@/lib/session-block-validation";
import { revalidatePath } from "next/cache";

async function assertAccess(sessionId: string) {
  const user = await requireUser();
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!(await canAccessSession(user, session))) throw new Error("Accès refusé.");
  return session;
}

function revalidateAll(sessionId: string) {
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath(`/seances/${sessionId}`);
}

export async function startBlock(sessionId: string, blockId: string) {
  const session = await assertAccess(sessionId);
  const block = await assertBlockBelongsToSession(sessionId, blockId);
  // Already started (a second tap, or a second coach) must not reset the clock;
  // DONE/SKIPPED (even if never actually started — a block can be skipped
  // straight from PENDING) must not be silently relaunched either.
  if (block.startedAt || block.status === "DONE" || block.status === "SKIPPED") return;
  await prisma.sessionBlock.update({ where: { id: blockId }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
  await ensureSessionInProgress(session);
  revalidateAll(sessionId);
}

// actualDurationMinutes is the real active time tracked client-side
// (pauses excluded) — durationMinutes (prévue) is never touched.
export async function completeBlock(sessionId: string, blockId: string, actualDurationMinutes: number) {
  await assertAccess(sessionId);
  const block = await assertBlockBelongsToSession(sessionId, blockId);
  if (block.status === "SKIPPED") return; // an explicit "passer" must not be silently overwritten by a stale complete call
  const parsed = actualDurationMinutesSchema.safeParse(actualDurationMinutes);
  if (!parsed.success) throw new Error("Durée invalide.");
  await prisma.sessionBlock.update({
    where: { id: blockId },
    data: { status: "DONE", endedAt: new Date(), actualDurationMinutes: Math.round(parsed.data) },
  });
  revalidateAll(sessionId);
}

export async function skipBlock(sessionId: string, blockId: string) {
  await assertAccess(sessionId);
  const block = await assertBlockBelongsToSession(sessionId, blockId);
  if (block.status === "DONE") return; // a completed block must not be silently flipped to skipped
  await prisma.sessionBlock.update({ where: { id: blockId }, data: { status: "SKIPPED", endedAt: new Date() } });
  revalidateAll(sessionId);
}
