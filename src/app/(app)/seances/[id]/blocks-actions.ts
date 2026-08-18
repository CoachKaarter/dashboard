"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession, scopedTeamIds } from "@/lib/authz";
import { sessionBlockTypeSchema, durationMinutesSchema, computeSwapPair } from "@/lib/session-block-validation";
import { assertBlockBelongsToSession } from "@/lib/session-scope";
import { canViewContentItem } from "@/lib/training-content-scope";
import { buildSessionBlockSnapshot } from "@/lib/training-content-snapshot";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
        coachingPoints: String(formData.get("coachingPoints") || "").trim() || null,
        variations: String(formData.get("variations") || "").trim() || null,
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
      coachingPoints: String(formData.get("coachingPoints") || "").trim() || null,
      variations: String(formData.get("variations") || "").trim() || null,
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

// V5.1 §33 — la séance reçoit une COPIE du contenu ("Bibliothèque ↓ Ajouter
// à la séance ↓ SessionBlock créé"). sourceLibraryItemId ne sert qu'à
// connaître l'origine — modifier l'item bibliothèque plus tard ne doit
// jamais changer rétroactivement ce SessionBlock (voir §2, principe
// d'historisation, et les tests snapshot dédiés).
export async function addLibraryItemToSession(sessionId: string, contentItemId: string) {
  const { user } = await assertAccess(sessionId);
  const source = await prisma.trainingContentItem.findUniqueOrThrow({ where: { id: contentItemId } });
  if (!canViewContentItem(user, source)) throw new Error("Accès refusé.");

  await prisma.$transaction(async (tx) => {
    const last = await tx.sessionBlock.findFirst({ where: { sessionId }, orderBy: { order: "desc" } });
    await tx.sessionBlock.create({
      data: { sessionId, ...buildSessionBlockSnapshot(source, (last?.order ?? -1) + 1) },
    });
  });
  revalidateBlockPaths(sessionId);
}

// V5.1 §43 — un bloc préparé librement pour une seule séance peut faire
// grandir la bibliothèque a posteriori. Le SessionBlock existant n'est pas
// modifié (sourceLibraryItemId est renseigné pour tracer la provenance,
// cohérent avec l'ajout dans l'autre sens).
export async function saveBlockAsLibraryItem(sessionId: string, blockId: string) {
  const { user } = await assertAccess(sessionId);
  const block = await assertBlockBelongsToSession(sessionId, blockId);

  const item = await prisma.trainingContentItem.create({
    data: {
      title: block.title,
      type: block.type,
      objective: block.objective,
      organization: block.organization,
      instructions: block.instructions,
      coachingPoints: block.coachingPoints,
      variations: block.variations,
      space: block.space,
      equipment: block.equipment,
      imageUrl: block.imageUrl,
      defaultDurationMinutes: block.durationMinutes,
      createdById: user.id,
      visibility: "PERSONAL",
    },
  });
  if (!block.sourceLibraryItemId) {
    await prisma.sessionBlock.update({ where: { id: blockId }, data: { sourceLibraryItemId: item.id } });
  }
  revalidateBlockPaths(sessionId);
  redirect(`/bibliotheque/${item.id}`);
}

// Renvoie les séances accessibles au coach, groupées pour le sélecteur
// "Ajouter à une séance" (§32) — aujourd'hui / cette semaine / à venir.
export async function listAddableSessions() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const inThreeWeeks = new Date(today);
  inThreeWeeks.setDate(inThreeWeeks.getDate() + 21);

  const allowedCategories =
    scope === "ALL" ? null : new Set((await prisma.team.findMany({ where: { id: { in: scope } } })).map((t) => t.category));

  const sessions = await prisma.trainingSession.findMany({
    where: { date: { gte: today, lte: inThreeWeeks }, status: { not: "Annulée" } },
    include: { scopeTeam: true },
    orderBy: { date: "asc" },
    take: 30,
  });
  return sessions
    .filter((s) => scope === "ALL" || (s.scopeTeamId ? scope.includes(s.scopeTeamId) : allowedCategories!.has(s.category)))
    .map((s) => ({
      id: s.id,
      label: `${s.scopeTeam?.code ?? s.category} — ${s.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`,
      date: s.date,
    }));
}
