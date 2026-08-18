"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession } from "@/lib/authz";
import { sessionBlockTypeSchema } from "@/lib/session-block-validation";
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
  const durationMinutes = Number(formData.get("durationMinutes"));
  if (!title || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return;

  const last = await prisma.sessionBlock.findFirst({ where: { sessionId }, orderBy: { order: "desc" } });
  await prisma.sessionBlock.create({
    data: {
      sessionId,
      order: (last?.order ?? -1) + 1,
      type: typeParsed.data,
      title,
      durationMinutes,
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

export async function updateBlock(sessionId: string, blockId: string, formData: FormData) {
  await assertAccess(sessionId);
  const typeParsed = sessionBlockTypeSchema.safeParse(formData.get("type"));
  if (!typeParsed.success) return;
  const title = String(formData.get("title") || "").trim();
  const durationMinutes = Number(formData.get("durationMinutes"));
  if (!title || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return;

  await prisma.sessionBlock.update({
    where: { id: blockId },
    data: {
      type: typeParsed.data,
      title,
      durationMinutes,
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
  await prisma.sessionBlock.delete({ where: { id: blockId } });
  revalidateBlockPaths(sessionId);
}

async function swapBlocks(sessionId: string, blockId: string, direction: -1 | 1) {
  await assertAccess(sessionId);
  const blocks = await prisma.sessionBlock.findMany({ where: { sessionId }, orderBy: { order: "asc" } });
  const i = blocks.findIndex((b) => b.id === blockId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= blocks.length) return;
  const a = blocks[i];
  const b = blocks[j];
  // Single transaction, never leaves two blocks sharing the same order.
  await prisma.$transaction([
    prisma.sessionBlock.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.sessionBlock.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);
  revalidateBlockPaths(sessionId);
}

export async function moveBlockUp(sessionId: string, blockId: string) {
  await swapBlocks(sessionId, blockId, -1);
}

export async function moveBlockDown(sessionId: string, blockId: string) {
  await swapBlocks(sessionId, blockId, 1);
}
