"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession } from "@/lib/authz";
import { canEditTemplate, canViewTemplate } from "@/lib/training-content-scope";
import { sessionTemplateNameSchema } from "@/lib/training-content-validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function assertSessionAccess(sessionId: string) {
  const user = await requireUser();
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!(await canAccessSession(user, session))) throw new Error("Accès refusé.");
  return { user, session };
}

// V5.1 §54/§55 — "Sauvegarder comme modèle" copie le déroulé ACTUEL de la
// séance (lui-même déjà un snapshot de bibliothèque le cas échéant) dans un
// nouveau SessionTemplate + SessionTemplateBlock — un second niveau de
// snapshot, jamais une référence vers SessionBlock ni vers la bibliothèque
// d'origine (modifier la séance ensuite ne doit pas changer le modèle).
export async function createTemplateFromSession(sessionId: string, formData: FormData) {
  const { user } = await assertSessionAccess(sessionId);
  const nameParsed = sessionTemplateNameSchema.safeParse(String(formData.get("name") || "").trim());
  if (!nameParsed.success) return;
  const description = String(formData.get("description") || "").trim() || null;
  const visibility = String(formData.get("visibility") || "PERSONAL") === "SHARED" ? "SHARED" : "PERSONAL";

  const blocks = await prisma.sessionBlock.findMany({ where: { sessionId }, orderBy: { order: "asc" } });

  const template = await prisma.sessionTemplate.create({
    data: {
      name: nameParsed.data,
      description,
      createdById: user.id,
      visibility,
      blocks: {
        create: blocks.map((b, i) => ({
          order: i,
          type: b.type,
          title: b.title,
          durationMinutes: b.durationMinutes,
          objective: b.objective,
          organization: b.organization,
          instructions: b.instructions,
          coachingPoints: b.coachingPoints,
          variations: b.variations,
          space: b.space,
          equipment: b.equipment,
          imageUrl: b.imageUrl,
          sourceLibraryItemId: b.sourceLibraryItemId,
        })),
      },
    },
  });
  revalidatePath("/bibliotheque/modeles");
  redirect(`/bibliotheque/modeles/${template.id}`);
}

// V5.1 §56/§57 — applique un modèle à une séance. "append" ajoute à la
// suite (ordre continué) ; "replace" exige une confirmation côté client
// (voir ApplyTemplateButton) et remplace intégralement le contenu actuel —
// jamais un remplacement silencieux.
export async function applyTemplateToSession(sessionId: string, templateId: string, mode: "append" | "replace") {
  const { user } = await assertSessionAccess(sessionId);
  const template = await prisma.sessionTemplate.findUniqueOrThrow({
    where: { id: templateId },
    include: { blocks: { orderBy: { order: "asc" } } },
  });
  if (!canViewTemplate(user, template)) throw new Error("Accès refusé.");

  await prisma.$transaction(async (tx) => {
    let startOrder = 0;
    if (mode === "replace") {
      await tx.sessionBlock.deleteMany({ where: { sessionId } });
    } else {
      const last = await tx.sessionBlock.findFirst({ where: { sessionId }, orderBy: { order: "desc" } });
      startOrder = (last?.order ?? -1) + 1;
    }
    for (const [i, b] of template.blocks.entries()) {
      await tx.sessionBlock.create({
        data: {
          sessionId,
          order: startOrder + i,
          type: b.type,
          title: b.title,
          durationMinutes: b.durationMinutes,
          objective: b.objective,
          organization: b.organization,
          instructions: b.instructions,
          coachingPoints: b.coachingPoints,
          variations: b.variations,
          space: b.space,
          equipment: b.equipment,
          imageUrl: b.imageUrl,
          sourceLibraryItemId: b.sourceLibraryItemId,
          // status/startedAt/endedAt/actualDurationMinutes left at defaults
          // (PENDING/null) — a template never carries terrain execution state.
        },
      });
    }
  });
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath(`/coach/seances/${sessionId}`);
}

export async function archiveTemplate(id: string, archived: boolean) {
  const user = await requireUser();
  const template = await prisma.sessionTemplate.findUniqueOrThrow({ where: { id } });
  if (!canEditTemplate(user, template)) throw new Error("Accès refusé.");
  await prisma.sessionTemplate.update({ where: { id }, data: { archived } });
  revalidatePath("/bibliotheque/modeles");
}

// Liste des modèles accessibles au coach, pour le sélecteur "Utiliser un modèle".
export async function listUsableTemplates() {
  const user = await requireUser();
  const templates = await prisma.sessionTemplate.findMany({
    where: { archived: false, OR: [{ visibility: "SHARED" }, { createdById: user.id }] },
    include: { _count: { select: { blocks: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return templates.map((t) => ({ id: t.id, name: t.name, blockCount: t._count.blocks }));
}
