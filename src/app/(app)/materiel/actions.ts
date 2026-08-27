"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser, canAccessTeam, canManageCategory } from "@/lib/authz";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { EQUIPMENT_CATEGORIES, CONDITIONS } from "@/lib/equipment";

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

async function assertEquipmentAccess(equipmentId: string) {
  const user = await requireUser();
  const equipment = await prisma.equipment.findUniqueOrThrow({ where: { id: equipmentId } });
  if (equipment.teamId && !canAccessTeam(user, equipment.teamId)) throw new Error("Accès refusé.");
  return { user, equipment };
}

async function assertAssignmentAccess(assignmentId: string) {
  const user = await requireUser();
  const assignment = await prisma.equipmentAssignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { equipment: true } });
  if (assignment.equipment.teamId && !canAccessTeam(user, assignment.equipment.teamId)) throw new Error("Accès refusé.");
  return { user, assignment };
}

export async function createEquipment(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get("teamId") || "") || null;
  if (teamId && !canAccessTeam(user, teamId)) return;
  const category = String(formData.get("category") || "MAILLOTS");
  if (!EQUIPMENT_CATEGORIES.includes(category as (typeof EQUIPMENT_CATEGORIES)[number])) return;
  const code = String(formData.get("code") || "").trim();
  const label = String(formData.get("label") || "").trim() || null;
  if (!code) return;

  await prisma.equipment.create({ data: { code, category, label, teamId } });
  revalidatePath("/materiel");
}

// Attribue un équipement disponible (aucune attribution active) à un
// joueur/famille — première ligne de son historique.
export async function assignEquipment(equipmentId: string, formData: FormData) {
  const { user, equipment } = await assertEquipmentAccess(equipmentId);
  const playerId = String(formData.get("playerId") || "") || null;
  const responsibleLabel = String(formData.get("responsibleLabel") || "").trim();
  const matchId = String(formData.get("matchId") || "") || null;
  const returnLocation = String(formData.get("returnLocation") || "").trim() || null;
  if (!responsibleLabel) return;

  const active = await prisma.equipmentAssignment.findFirst({
    where: { equipmentId, status: { not: "RECUPERE_STAFF" } },
    orderBy: { createdAt: "desc" },
  });
  if (active) return; // déjà attribué — passer par reassignEquipment

  const settings = await getSettings();
  const issuedDate = new Date();
  const dueDateRaw = String(formData.get("dueDate") || "");
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : addDays(issuedDate, settings.delaiMaillots);

  const parentAccount = playerId ? await prisma.parentAccount.findUnique({ where: { playerId } }) : null;

  await prisma.equipmentAssignment.create({
    data: {
      equipmentId,
      playerId,
      parentAccountId: parentAccount?.id ?? null,
      responsibleLabel,
      matchId,
      returnLocation,
      issuedDate,
      dueDate,
      status: "CHEZ_LE_JOUEUR",
      createdById: user.id,
    },
  });
  await logActivity({
    actorId: user.id,
    summary: `a attribué ${equipment.code} à ${responsibleLabel}`,
    entityType: "Equipment",
    entityId: equipmentId,
  });
  revalidatePath("/materiel");
  revalidatePath("/");
}

// Referme le cycle en cours (s'il existe, sans exiger une confirmation de
// récupération séparée — réattribuer VAUT reconnaissance que ce cycle est
// terminé) puis ouvre un nouveau cycle. L'ancienne ligne reste dans
// l'historique telle quelle (spec §5 : historique des attributions).
export async function reassignEquipment(equipmentId: string, formData: FormData) {
  const { user, equipment } = await assertEquipmentAccess(equipmentId);
  const playerId = String(formData.get("playerId") || "") || null;
  const responsibleLabel = String(formData.get("responsibleLabel") || "").trim();
  const matchId = String(formData.get("matchId") || "") || null;
  const returnLocation = String(formData.get("returnLocation") || "").trim() || null;
  if (!responsibleLabel) return;

  const active = await prisma.equipmentAssignment.findFirst({
    where: { equipmentId, status: { not: "RECUPERE_STAFF" } },
    orderBy: { createdAt: "desc" },
  });
  const settings = await getSettings();
  const issuedDate = new Date();
  const dueDateRaw = String(formData.get("dueDate") || "");
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : addDays(issuedDate, settings.delaiMaillots);
  const parentAccount = playerId ? await prisma.parentAccount.findUnique({ where: { playerId } }) : null;

  await prisma.$transaction(async (tx) => {
    if (active) {
      await tx.equipmentAssignment.update({ where: { id: active.id }, data: { status: "RECUPERE_STAFF", returnedDate: new Date() } });
    }
    await tx.equipmentAssignment.create({
      data: {
        equipmentId,
        playerId,
        parentAccountId: parentAccount?.id ?? null,
        responsibleLabel,
        matchId,
        returnLocation,
        issuedDate,
        dueDate,
        status: "CHEZ_LE_JOUEUR",
        createdById: user.id,
      },
    });
  });
  await logActivity({
    actorId: user.id,
    summary: `a réattribué ${equipment.code} à ${responsibleLabel}`,
    entityType: "Equipment",
    entityId: equipmentId,
  });
  revalidatePath("/materiel");
  revalidatePath("/");
}

// Modifie l'attribution en cours (responsable, joueur, rencontre, date/lieu
// de retour) sans ouvrir un nouveau cycle — pour une correction, pas un
// nouveau prêt. "Renouveler le rappel" (repousser l'échéance) passe aussi
// par ici : seule dueDate change.
export async function updateAssignment(assignmentId: string, formData: FormData) {
  const { user, assignment } = await assertAssignmentAccess(assignmentId);
  const playerId = String(formData.get("playerId") || "") || null;
  const responsibleLabel = String(formData.get("responsibleLabel") || "").trim();
  const matchId = String(formData.get("matchId") || "") || null;
  const returnLocation = String(formData.get("returnLocation") || "").trim() || null;
  const dueDateRaw = String(formData.get("dueDate") || "");
  if (!responsibleLabel || !dueDateRaw) return;
  const dueDate = new Date(dueDateRaw);
  if (Number.isNaN(dueDate.getTime())) return;
  const parentAccount = playerId ? await prisma.parentAccount.findUnique({ where: { playerId } }) : null;

  await prisma.equipmentAssignment.update({
    where: { id: assignmentId },
    data: { playerId, parentAccountId: parentAccount?.id ?? null, responsibleLabel, matchId, returnLocation, dueDate },
  });
  await logActivity({ actorId: user.id, summary: `a modifié l'attribution de ${assignment.equipment.code}`, entityType: "EquipmentAssignment", entityId: assignmentId });
  revalidatePath("/materiel");
  revalidatePath("/");
}

export async function setAssignmentCondition(assignmentId: string, formData: FormData) {
  await assertAssignmentAccess(assignmentId);
  const condition = String(formData.get("condition") || "");
  if (!CONDITIONS.includes(condition as (typeof CONDITIONS)[number])) return;
  await prisma.equipmentAssignment.update({ where: { id: assignmentId }, data: { condition } });
  revalidatePath("/materiel");
}

export async function setAssignmentWashed(assignmentId: string, formData: FormData) {
  await assertAssignmentAccess(assignmentId);
  const washed = formData.get("washed") === "on";
  await prisma.equipmentAssignment.update({ where: { id: assignmentId }, data: { washed } });
  revalidatePath("/materiel");
}

export async function setAssignmentComment(assignmentId: string, formData: FormData) {
  await assertAssignmentAccess(assignmentId);
  const staffComment = String(formData.get("staffComment") || "").trim() || null;
  await prisma.equipmentAssignment.update({ where: { id: assignmentId }, data: { staffComment } });
  revalidatePath("/materiel");
}

// Confirmation physique de la récupération — SEUL un membre du staff
// autorisé (Responsable de la catégorie ou Admin) peut la déclencher (spec
// §5/§7) : un simple Coach ne clôture pas le prêt, même s'il a accès à
// l'équipe. Retire le rappel de l'espace parents (le cycle n'est plus actif).
export async function markEquipmentRecovered(assignmentId: string) {
  const { user, assignment } = await assertAssignmentAccess(assignmentId);
  const category = assignment.equipment.teamId ? (await prisma.team.findUnique({ where: { id: assignment.equipment.teamId } }))?.category : null;
  const authorized = user.role === "ADMIN" || (category ? canManageCategory(user, category) : true);
  if (!authorized) throw new Error("Seul un membre autorisé du staff peut confirmer la récupération.");

  await prisma.equipmentAssignment.update({ where: { id: assignmentId }, data: { status: "RECUPERE_STAFF", returnedDate: new Date() } });
  await logActivity({ actorId: user.id, summary: `a confirmé la récupération de ${assignment.equipment.code}`, entityType: "EquipmentAssignment", entityId: assignmentId });
  revalidatePath("/materiel");
  revalidatePath("/");
}

export async function deleteEquipment(equipmentId: string) {
  const { user, equipment } = await assertEquipmentAccess(equipmentId);
  await prisma.equipment.delete({ where: { id: equipmentId } });
  await logActivity({ actorId: user.id, summary: `a supprimé le matériel ${equipment.code}`, entityType: "Equipment" });
  revalidatePath("/materiel");
}
