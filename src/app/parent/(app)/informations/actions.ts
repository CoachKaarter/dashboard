"use server";

import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/parent-session";
import { notifyTeamStaff, notifyCategoryStaff } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { redirect } from "next/navigation";

// Validation manuelle, même style que src/app/parent/(app)/indisponibilite/actions.ts
// — pas de Zod côté parent dans ce codebase, uniquement des vérifications
// inline + un rejet silencieux (retour à la même page) si un champ requis
// manque, jamais un formulaire à moitié traité.
export async function submitParentOnboardingInfo(formData: FormData) {
  const parent = await requireParent();
  if (parent.onboardingCompletedAt) redirect("/parent");

  const parentFirstName = String(formData.get("parentFirstName") || "").trim();
  const parentLastName = String(formData.get("parentLastName") || "").trim();
  const parentPhone = String(formData.get("parentPhone") || "").trim();
  if (!parentFirstName || !parentLastName || !parentPhone) redirect("/parent/informations");

  // Jamais confiance dans les ids d'enfant soumis — ne retient que ceux qui
  // appartiennent réellement au compte connecté.
  const ownChildIds = new Set(parent.children.map((c) => c.id));
  const submittedChildIds = formData.getAll("childIds").map(String).filter((id) => ownChildIds.has(id));

  type ChildSubmission = { playerId: string; firstName: string; lastName: string; birthDate: Date; licenseNumber: string };
  const childSubmissions: ChildSubmission[] = [];
  for (const playerId of submittedChildIds) {
    const firstName = String(formData.get(`child_${playerId}_firstName`) || "").trim();
    const lastName = String(formData.get(`child_${playerId}_lastName`) || "").trim();
    const birthDateRaw = String(formData.get(`child_${playerId}_birthDate`) || "");
    const licenseNumber = String(formData.get(`child_${playerId}_licenseNumber`) || "").trim();
    const birthDate = birthDateRaw ? new Date(birthDateRaw) : null;
    if (!firstName || !lastName || !licenseNumber || !birthDate || Number.isNaN(birthDate.getTime())) redirect("/parent/informations");
    childSubmissions.push({ playerId, firstName, lastName, birthDate, licenseNumber });
  }

  // Idempotent : un enfant déjà couvert par une soumission PENDING/VALIDATED
  // (ex. double soumission, ou navigateur revenu en arrière) n'est pas
  // resoumis — évite d'empiler des doublons en attente de validation.
  const alreadyCovered = new Set(
    (
      await prisma.playerFamilyInfoSubmission.findMany({
        where: { playerId: { in: childSubmissions.map((c) => c.playerId) }, status: { in: ["PENDING", "VALIDATED"] } },
        select: { playerId: true },
      })
    ).map((s) => s.playerId)
  );
  const toCreate = childSubmissions.filter((c) => !alreadyCovered.has(c.playerId));

  await prisma.$transaction([
    prisma.parentAccount.update({
      where: { id: parent.parentAccountId },
      data: { firstName: parentFirstName, lastName: parentLastName, phone: parentPhone, onboardingCompletedAt: new Date() },
    }),
    ...toCreate.map((c) =>
      prisma.playerFamilyInfoSubmission.create({
        data: {
          playerId: c.playerId,
          submittedById: parent.parentAccountId,
          firstName: c.firstName,
          lastName: c.lastName,
          birthDate: c.birthDate,
          licenseNumber: c.licenseNumber,
        },
      })
    ),
  ]);

  for (const c of toCreate) {
    const child = parent.children.find((ch) => ch.id === c.playerId);
    if (!child) continue;
    await logActivity({
      actorId: null,
      summary: `La famille de ${child.firstName} ${child.lastName} a déclaré ses informations (nom, date de naissance, licence) — en attente de validation`,
      entityType: "Player",
      entityId: c.playerId,
    });
    const notifyPayload = {
      type: "family-info-declared",
      title: `${child.firstName} ${child.lastName} — informations famille à valider`,
      href: `/joueurs/${c.playerId}`,
    };
    if (child.teamId) await notifyTeamStaff(child.teamId, notifyPayload);
    else await notifyCategoryStaff(child.teamCategory, notifyPayload);
  }

  redirect("/parent/bienvenue");
}
