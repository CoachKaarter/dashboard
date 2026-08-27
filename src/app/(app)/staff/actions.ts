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

// teamIds is no longer set here — it's the frozen legacy sporting-scope
// field (see User.teamIds in prisma/schema.prisma). A new account starts
// with zero responsibilities; they're added afterward via addStaffAccess
// on the staff detail page, same as for any existing account.
export async function createStaff(formData: FormData) {
  const admin = await requireAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const accessLabel = String(formData.get("accessLabel") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!username || !name || !ROLES.includes(role) || !jobTitle || !accessLabel) return;

  const tempPassword = randomPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const user = await prisma.user.create({
    data: { username, name, role, jobTitle, accessLabel, email, phone, passwordHash },
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
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!name || !ROLES.includes(role) || !jobTitle || !accessLabel) return;

  await prisma.user.update({
    where: { id: userId },
    data: { name, role, jobTitle, accessLabel, email, phone },
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

const ACCESS_LEVELS = ["COACH", "RESPONSABLE"];
const ACCESS_SCOPES = ["TEAM", "CATEGORY", "SCHOOL"];

function accessScopeLabel(scope: string, category: string | null, teamCode: string | undefined) {
  if (scope === "TEAM") return teamCode ?? "équipe";
  if (scope === "CATEGORY") return category ?? "catégorie";
  return "école de foot";
}

// A grant is unique per (user, scope, category-or-team) at the database
// level (partial unique indexes — Prisma's schema DSL can't declare a
// conditional unique index, so there's no typed `where` target for it, see
// migration 20260825150000). Submitting the same périmètre again therefore
// updates its level in place (this doubles as the "changer Responsable →
// Coach" flow from the staff spec) rather than failing or duplicating.
export async function addStaffAccess(userId: string, formData: FormData) {
  const admin = await requireAdmin();
  const level = String(formData.get("level") ?? "");
  const scope = String(formData.get("scope") ?? "");
  if (!ACCESS_LEVELS.includes(level) || !ACCESS_SCOPES.includes(scope)) return;

  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  let category: string | null = null;
  let teamId: string | null = null;
  let teamCode: string | undefined;
  if (scope === "TEAM") {
    teamId = String(formData.get("teamId") ?? "") || null;
    if (!teamId) return;
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return;
    teamCode = team.code;
  } else if (scope === "CATEGORY") {
    category = String(formData.get("category") ?? "").trim() || null;
    if (!category) return;
  }

  const existing = await prisma.staffAccess.findFirst({ where: { userId, scope, category, teamId } });
  if (existing) {
    await prisma.staffAccess.update({ where: { id: existing.id }, data: { level, grantedById: admin.id } });
  } else {
    await prisma.staffAccess.create({ data: { userId, level, scope, category, teamId, grantedById: admin.id } });
  }

  const levelLabel = level === "RESPONSABLE" ? "Responsable" : "Coach";
  await logActivity({
    actorId: admin.id,
    summary: `a attribué "${levelLabel} ${accessScopeLabel(scope, category, teamCode)}" à ${target.name}`,
    entityType: "User",
    entityId: userId,
  });
  revalidatePath(`/staff/${userId}`);
  revalidatePath("/staff");
}

export async function removeStaffAccess(accessId: string) {
  const admin = await requireAdmin();
  const access = await prisma.staffAccess.findUniqueOrThrow({ where: { id: accessId }, include: { user: true, team: true } });
  await prisma.staffAccess.delete({ where: { id: accessId } });

  const levelLabel = access.level === "RESPONSABLE" ? "Responsable" : "Coach";
  await logActivity({
    actorId: admin.id,
    summary: `a retiré "${levelLabel} ${accessScopeLabel(access.scope, access.category, access.team?.code)}" à ${access.user.name}`,
    entityType: "User",
    entityId: access.userId,
  });
  revalidatePath(`/staff/${access.userId}`);
  revalidatePath("/staff");
}
