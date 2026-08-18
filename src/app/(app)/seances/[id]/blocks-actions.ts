"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession } from "@/lib/authz";
import { sessionBlockTypeSchema, durationMinutesSchema, computeSwapPair } from "@/lib/session-block-validation";
import { assertBlockBelongsToSession } from "@/lib/session-scope";
import { revalidatePath } from "next/cache";

async function assertAccess(sessionId: string) {
  const user = await requireUser();
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!(await canAccessSession(user, session))) throw new Error("Accès refusé.");
  return { user, session };
}

function revalidateBlockPaths(sessionId: string) {
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath(`/coach/seances/${sessionId}`);
}

export async function createBlock(sessionId: string, formData: FormData) {
  await assertAccess(sessionId);
  const typeParsed = sessionBlockTypeSchema.safeParse(formData.get("type"));
  if (!typeParsed.success) return;
  const title = String(formData.get("title") || "").trim();
  const durationParsed = durationMinutesSchema.safeParse(Number(formData.get("durationMinutes")));
  if (!title || !durationParsed.success) return;

  await prisma.$transaction(async (tx) => {
    const last = await tx.sessionBlock.findFirst({ where: { sessionId }, orderBy: { order: "desc" } });
    await tx.sessionBlock.create({
      data: {
        sessionId,
        order: (last?.order ?? -1) + 1,
        type: typeParsed.data,
        title,
        durationMinutes: durationParsed.data,
        objective: String(formData.get("objective") || "").trim() || null,
        organization: String(formData.get("organization") || "").trim() || null,
        instructions: String(formData.get("instructions") || "").trim() || null,
        space: String(formData.get("space") || "").trim() || null,
        equipment: String(formData.get("equipment") || "").trim() || null,
        imageUrl: String(formData.get("imageUrl") || "").trim() || null,
        coachNote: String(formData.get("coachNote") || "").trim() || null,
      },
    });
  });
  revalidateBlockPaths(sessionId);
}

export async function updateBlock(sessionId: string, blockId: string, formData: FormData) {
  await assertAccess(sessionId);
  await assertBlockBelongsToSession(sessionId, blockId);
  const typeParsed = sessionBlockTypeSchema.safeParse(formData.get("type"));
  if (!typeParsed.success) return;
  const title = String(formData.get("title") || "").trim();
  const durationParsed = durationMinutesSchema.safeParse(Number(formData.get("durationMinutes")));
  if (!title || !durationParsed.success) return;

  await prisma.sessionBlock.update({
    where: { id: blockId },
    data: {
      type: typeParsed.data,
      title,
      durationMinutes: durationParsed.data,
      objective: String(formData.get("objective") || "").trim() || null,
      organization: String(formData.get("organization") || "").trim() || null,
      instructions: String(formData.get("instructions") || "").trim() || null,
      space: String(formData.get("space") || "").trim() || null,
      equipment: String(formData.get("equipment") || "").trim() || null,
      imageUrl: String(formData.get("imageUrl") || "").trim() || null,
      coachNote: String(formData.get("coachNote") || "").trim() || null,
    },
  });
  revalidateBlockPaths(sessionId);
}

export async function deleteBlock(sessionId: string, blockId: string) {
  await assertAccess(sessionId);
  await assertBlockBelongsToSession(sessionId, blockId);
  // Orders are left sparse after a delete (e.g. 0,1,3 after removing order 2) —
  // nothing depends on contiguity, only relative order (orderBy "order asc"),
  // and the sessionId+order unique constraint tolerates gaps fine.
  await prisma.sessionBlock.delete({ where: { id: blockId } });
  revalidateBlockPaths(sessionId);
}

async function swapBlocks(sessionId: string, blockId: string, direction: -1 | 1) {
  await assertAccess(sessionId);
  const blocks = await prisma.sessionBlock.findMany({ where: { sessionId }, orderBy: { order: "asc" } });
  const pair = computeSwapPair(blocks, blockId, direction);
  if (!pair) return;
  const { a, b } = pair;
  // sessionId+order is unique in DB, so a direct A<->B swap would collide
  // mid-transaction. Stage one row through a temporary out-of-range order first.
  await prisma.$transaction(async (tx) => {
    await tx.sessionBlock.update({ where: { id: a.id }, data: { order: -1 } });
    await tx.sessionBlock.update({ where: { id: b.id }, data: { order: a.order } });
    await tx.sessionBlock.update({ where: { id: a.id }, data: { order: b.order } });
  });
  revalidateBlockPaths(sessionId);
}

export async function moveBlockUp(sessionId: string, blockId: string) {
  await swapBlocks(sessionId, blockId, -1);
}

export async function moveBlockDown(sessionId: string, blockId: string) {
  await swapBlocks(sessionId, blockId, 1);
}
