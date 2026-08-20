"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds, canAccessTeam } from "@/lib/authz";
import { announcementSchema } from "@/lib/announcement-validation";
import { logActivity } from "@/lib/activity";
import { revalidatePath } from "next/cache";

export async function createAnnouncement(formData: FormData) {
  const user = await requireUser();
  const scopeTeamIdRaw = String(formData.get("scopeTeamId") || "").trim();
  const parsed = announcementSchema.safeParse({
    title: String(formData.get("title") || ""),
    body: String(formData.get("body") || ""),
    category: String(formData.get("category") || ""),
    targetCategory: String(formData.get("targetCategory") || ""),
    scopeTeamId: scopeTeamIdRaw || null,
  });
  if (!parsed.success) return;

  const scope = scopedTeamIds(user);
  if (parsed.data.scopeTeamId) {
    if (!canAccessTeam(user, parsed.data.scopeTeamId)) return;
  } else if (scope !== "ALL") {
    // Category-wide announcement: require access to at least one team in that category.
    const count = await prisma.team.count({ where: { id: { in: scope }, category: parsed.data.targetCategory } });
    if (count === 0) return;
  }

  const announcement = await prisma.staffAnnouncement.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      category: parsed.data.category,
      targetCategory: parsed.data.targetCategory,
      scopeTeamId: parsed.data.scopeTeamId,
      authorId: user.id,
    },
  });
  await logActivity({
    actorId: user.id,
    summary: `a publié une annonce famille : "${announcement.title}"`,
    entityType: "StaffAnnouncement",
    entityId: announcement.id,
  });
  revalidatePath("/annonces");
}

export async function deleteAnnouncement(id: string) {
  const user = await requireUser();
  const announcement = await prisma.staffAnnouncement.findUniqueOrThrow({ where: { id } });
  if (announcement.scopeTeamId) {
    if (!canAccessTeam(user, announcement.scopeTeamId)) throw new Error("Accès refusé.");
  } else {
    const scope = scopedTeamIds(user);
    if (scope !== "ALL") {
      const count = await prisma.team.count({ where: { id: { in: scope }, category: announcement.targetCategory } });
      if (count === 0) throw new Error("Accès refusé.");
    }
  }
  await prisma.staffAnnouncement.delete({ where: { id } });
  revalidatePath("/annonces");
}
