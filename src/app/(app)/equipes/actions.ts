"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requireAdmin, canAccessTeam } from "@/lib/authz";
import { logActivity } from "@/lib/activity";

export async function updateTeamTarget(teamId: string, formData: FormData) {
  const user = await requireUser();
  if (!canAccessTeam(user, teamId)) return;
  const raw = String(formData.get("targetSize") ?? "").trim();
  const targetSize = raw ? Number(raw) : null;
  await prisma.team.update({ where: { id: teamId }, data: { targetSize } });
  revalidatePath("/equipes");
  revalidatePath(`/equipes/${teamId}`);
}

const TEAM_FORMATS = ["Foot à 5", "Foot à 8", "Foot à 11"];

export async function updateTeamFormat(teamId: string, formData: FormData) {
  const user = await requireUser();
  if (!canAccessTeam(user, teamId)) return;
  const format = String(formData.get("format") ?? "");
  if (!TEAM_FORMATS.includes(format)) return;
  await prisma.team.update({ where: { id: teamId }, data: { format } });
  revalidatePath("/equipes");
  revalidatePath(`/equipes/${teamId}`);
}

export async function createTeam(formData: FormData) {
  const admin = await requireAdmin();
  const code = String(formData.get("code") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const format = String(formData.get("format") ?? "");
  const rawTarget = String(formData.get("targetSize") ?? "").trim();
  if (!code || !category || !TEAM_FORMATS.includes(format)) return;
  const targetSize = rawTarget ? Number(rawTarget) : null;

  const team = await prisma.team.create({ data: { code, category, format, targetSize } });
  await logActivity({ actorId: admin.id, summary: `a créé l'équipe ${team.code} (${team.category})`, entityType: "Team", entityId: team.id });
  revalidatePath("/equipes");
  redirect(`/equipes/${team.id}`);
}

export async function updateTeamCoach(teamId: string, formData: FormData) {
  await requireAdmin();
  const coachId = String(formData.get("coachId") || "") || null;
  await prisma.team.update({ where: { id: teamId }, data: { coachId } });
  revalidatePath("/equipes");
  revalidatePath(`/equipes/${teamId}`);
}
