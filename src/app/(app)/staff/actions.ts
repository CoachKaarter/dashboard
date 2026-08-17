"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import { logActivity } from "@/lib/activity";

const ROLES = ["ADMIN", "COACH", "STAFF"];

function randomPassword() {
  return Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);
}

export async function createStaff(formData: FormData) {
  const admin = await requireAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const accessLabel = String(formData.get("accessLabel") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const teamIds = formData.getAll("teamIds").map(String);
  if (!username || !name || !ROLES.includes(role) || !jobTitle || !accessLabel) return;

  const tempPassword = randomPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const user = await prisma.user.create({
    data: { username, name, role, jobTitle, accessLabel, email, teamIds, passwordHash },
  });
  await logActivity({ actorId: admin.id, summary: `a créé le compte ${name} (${role})`, entityType: "User", entityId: user.id });
  revalidatePath("/staff");
  redirect(`/staff/${user.id}?tempPassword=${tempPassword}`);
}

export async function updateStaff(userId: string, formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const accessLabel = String(formData.get("accessLabel") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const teamIds = formData.getAll("teamIds").map(String);
  if (!name || !ROLES.includes(role) || !jobTitle || !accessLabel) return;

  await prisma.user.update({
    where: { id: userId },
    data: { name, role, jobTitle, accessLabel, email, teamIds },
  });
  await logActivity({ actorId: admin.id, summary: `a modifié le compte ${name}`, entityType: "User", entityId: userId });
  revalidatePath("/staff");
  revalidatePath(`/staff/${userId}`);
}

export async function setActive(userId: string, active: boolean) {
  const admin = await requireAdmin();
  if (userId === admin.id && !active) return; // can't lock yourself out
  const target = await prisma.user.update({ where: { id: userId }, data: { active } });
  await logActivity({
    actorId: admin.id,
    summary: `a ${active ? "réactivé" : "désactivé"} le compte ${target.name}`,
    entityType: "User",
    entityId: userId,
  });
  revalidatePath("/staff");
  revalidatePath(`/staff/${userId}`);
}

export async function resetPassword(userId: string) {
  const admin = await requireAdmin();
  const tempPassword = randomPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const target = await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await logActivity({ actorId: admin.id, summary: `a réinitialisé le mot de passe de ${target.name}`, entityType: "User", entityId: userId });
  revalidatePath(`/staff/${userId}`);
  redirect(`/staff/${userId}?tempPassword=${tempPassword}`);
}
