"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contentItemSchema, tagNameSchema, slugifyTag } from "@/lib/training-content-validation";
import { canEditContentItem, canViewContentItem } from "@/lib/training-content-scope";

async function assertCanEdit(id: string) {
  const user = await requireUser();
  const item = await prisma.trainingContentItem.findUniqueOrThrow({ where: { id } });
  if (!canEditContentItem(user, item)) throw new Error("Accès refusé.");
  return { user, item };
}

function parseTagNames(raw: FormDataEntryValue | null): string[] {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => tagNameSchema.safeParse(s).success)
    .slice(0, 15);
}

async function upsertTagsByName(names: string[]) {
  const tags = await Promise.all(
    names.map((name) =>
      prisma.trainingContentTag.upsert({
        where: { slug: slugifyTag(name) },
        update: {},
        create: { name, slug: slugifyTag(name), category: null },
      })
    )
  );
  return tags.map((t) => t.id);
}

function readItemForm(formData: FormData) {
  const num = (key: string) => {
    const v = String(formData.get(key) || "").trim();
    return v ? Number(v) : null;
  };
  return contentItemSchema.safeParse({
    title: String(formData.get("title") || "").trim(),
    type: String(formData.get("type") || ""),
    description: String(formData.get("description") || "").trim() || null,
    objective: String(formData.get("objective") || "").trim() || null,
    organization: String(formData.get("organization") || "").trim() || null,
    instructions: String(formData.get("instructions") || "").trim() || null,
    coachingPoints: String(formData.get("coachingPoints") || "").trim() || null,
    variations: String(formData.get("variations") || "").trim() || null,
    space: String(formData.get("space") || "").trim() || null,
    equipment: String(formData.get("equipment") || "").trim() || null,
    imageUrl: String(formData.get("imageUrl") || "").trim() || null,
    defaultDurationMinutes: num("defaultDurationMinutes"),
    minPlayers: num("minPlayers"),
    maxPlayers: num("maxPlayers"),
    format: String(formData.get("format") || "").trim() || null,
    categories: String(formData.get("categories") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    visibility: String(formData.get("visibility") || "PERSONAL"),
  });
}

export async function createContentItem(formData: FormData) {
  const user = await requireUser();
  const parsed = readItemForm(formData);
  if (!parsed.success) return;
  const tagIds = await upsertTagsByName(parseTagNames(formData.get("tags")));

  const item = await prisma.trainingContentItem.create({
    data: {
      ...parsed.data,
      imageUrl: parsed.data.imageUrl || null,
      createdById: user.id,
      tags: { connect: tagIds.map((id) => ({ id })) },
    },
  });
  if (item.visibility === "SHARED") {
    await logActivity({
      actorId: user.id,
      summary: `a partagé le procédé "${item.title}" avec le staff`,
      entityType: "TrainingContentItem",
      entityId: item.id,
    });
  } else {
    await logActivity({
      actorId: user.id,
      summary: `a créé le procédé "${item.title}"`,
      entityType: "TrainingContentItem",
      entityId: item.id,
    });
  }
  revalidatePath("/bibliotheque");
  redirect(`/bibliotheque/${item.id}`);
}

export async function updateContentItem(id: string, formData: FormData) {
  const { item: before } = await assertCanEdit(id);
  const parsed = readItemForm(formData);
  if (!parsed.success) return;
  const tagIds = await upsertTagsByName(parseTagNames(formData.get("tags")));

  await prisma.trainingContentItem.update({
    where: { id },
    data: {
      ...parsed.data,
      imageUrl: parsed.data.imageUrl || null,
      tags: { set: tagIds.map((tagId) => ({ id: tagId })) },
    },
  });
  if (before.visibility !== "SHARED" && parsed.data.visibility === "SHARED") {
    const user = await requireUser();
    await logActivity({
      actorId: user.id,
      summary: `a partagé le procédé "${parsed.data.title}" avec le staff`,
      entityType: "TrainingContentItem",
      entityId: id,
    });
  }
  revalidatePath("/bibliotheque");
  revalidatePath(`/bibliotheque/${id}`);
}

export async function archiveContentItem(id: string, archived: boolean) {
  const { user, item } = await assertCanEdit(id);
  await prisma.trainingContentItem.update({ where: { id }, data: { archived } });
  await logActivity({
    actorId: user.id,
    summary: `a ${archived ? "archivé" : "restauré"} le procédé "${item.title}"`,
    entityType: "TrainingContentItem",
    entityId: id,
  });
  revalidatePath("/bibliotheque");
  revalidatePath(`/bibliotheque/${id}`);
}

// Hard delete réservé ADMIN, et seulement si l'item n'a jamais servi
// (§31 — l'archivage reste le comportement normal).
export async function hardDeleteContentItem(id: string) {
  await requireAdmin();
  const usageCount = await prisma.sessionBlock.count({ where: { sourceLibraryItemId: id } });
  const templateUsageCount = await prisma.sessionTemplateBlock.count({ where: { sourceLibraryItemId: id } });
  if (usageCount > 0 || templateUsageCount > 0) throw new Error("Ce procédé a déjà été utilisé — archivez-le plutôt.");
  await prisma.trainingContentItem.delete({ where: { id } });
  revalidatePath("/bibliotheque");
  redirect("/bibliotheque");
}

export async function duplicateContentItem(id: string) {
  const user = await requireUser();
  const source = await prisma.trainingContentItem.findUniqueOrThrow({ where: { id }, include: { tags: true } });
  if (!canViewContentItem(user, source)) throw new Error("Accès refusé.");

  const copy = await prisma.trainingContentItem.create({
    data: {
      title: `${source.title} — copie`,
      type: source.type,
      description: source.description,
      objective: source.objective,
      organization: source.organization,
      instructions: source.instructions,
      coachingPoints: source.coachingPoints,
      variations: source.variations,
      space: source.space,
      equipment: source.equipment,
      imageUrl: source.imageUrl,
      defaultDurationMinutes: source.defaultDurationMinutes,
      minPlayers: source.minPlayers,
      maxPlayers: source.maxPlayers,
      format: source.format,
      categories: source.categories,
      createdById: user.id,
      visibility: "PERSONAL",
      tags: { connect: source.tags.map((t) => ({ id: t.id })) },
    },
  });
  revalidatePath("/bibliotheque");
  redirect(`/bibliotheque/${copy.id}`);
}

// Recherche rapide pour la colonne bibliothèque du Session Studio (§39).
export async function searchLibraryItems(query: string) {
  const user = await requireUser();
  const q = query.trim();
  const scopeWhere = user.role === "ADMIN" ? {} : { OR: [{ visibility: "SHARED" }, { createdById: user.id }] };
  const items = await prisma.trainingContentItem.findMany({
    where: {
      archived: false,
      ...scopeWhere,
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, title: true, type: true, defaultDurationMinutes: true, minPlayers: true },
  });
  return items;
}

export async function toggleFavorite(contentItemId: string) {
  const user = await requireUser();
  const existing = await prisma.trainingContentFavorite.findUnique({
    where: { userId_contentItemId: { userId: user.id, contentItemId } },
  });
  if (existing) {
    await prisma.trainingContentFavorite.delete({ where: { id: existing.id } });
  } else {
    await prisma.trainingContentFavorite.create({ data: { userId: user.id, contentItemId } });
  }
  revalidatePath("/bibliotheque");
  revalidatePath(`/bibliotheque/${contentItemId}`);
}
