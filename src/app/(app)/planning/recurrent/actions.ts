"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin, canAccessTeam } from "@/lib/authz";

async function assertSlotAccess(slotId: string) {
  const user = await requireUser();
  const slot = await prisma.recurringSlot.findUniqueOrThrow({ where: { id: slotId } });
  if (user.role !== "ADMIN" && (!slot.scopeTeamId || !canAccessTeam(user, slot.scopeTeamId))) {
    throw new Error("Accès refusé.");
  }
  return slot;
}

export async function createSlot(formData: FormData) {
  await requireAdmin();
  const category = String(formData.get("category") ?? "");
  const scopeTeamId = String(formData.get("scopeTeamId") || "") || null;
  const weekday = Number(formData.get("weekday"));
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || "Séance commune";
  if (!category || Number.isNaN(weekday) || !startTime || !endTime || !location) return;

  await prisma.recurringSlot.create({
    data: { category, scopeTeamId, weekday, startTime, endTime, location, label },
  });
  revalidatePath("/planning/recurrent");
}

export async function toggleSlotActive(slotId: string) {
  const slot = await assertSlotAccess(slotId);
  await prisma.recurringSlot.update({ where: { id: slotId }, data: { active: !slot.active } });
  revalidatePath("/planning/recurrent");
}

export async function deleteSlot(slotId: string) {
  await assertSlotAccess(slotId);
  await prisma.recurringSlot.delete({ where: { id: slotId } });
  revalidatePath("/planning/recurrent");
}
