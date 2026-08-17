"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin, canAccessTeam } from "@/lib/authz";

export async function updateTeamTarget(teamId: string, formData: FormData) {
  const user = await requireUser();
  if (!canAccessTeam(user, teamId)) return;
  const raw = String(formData.get("targetSize") ?? "").trim();
  const targetSize = raw ? Number(raw) : null;
  await prisma.team.update({ where: { id: teamId }, data: { targetSize } });
  revalidatePath("/equipes");
  revalidatePath(`/equipes/${teamId}`);
}

export async function updateTeamFormat(teamId: string, formData: FormData) {
  const user = await requireUser();
  if (!canAccessTeam(user, teamId)) return;
  const format = String(formData.get("format") ?? "");
  if (format !== "Foot à 8" && format !== "Foot à 11") return;
  await prisma.team.update({ where: { id: teamId }, data: { format } });
  revalidatePath("/equipes");
  revalidatePath(`/equipes/${teamId}`);
}

export async function updateTeamCoach(teamId: string, formData: FormData) {
  await requireAdmin();
  const coachId = String(formData.get("coachId") || "") || null;
  await prisma.team.update({ where: { id: teamId }, data: { coachId } });
  revalidatePath("/equipes");
  revalidatePath(`/equipes/${teamId}`);
}
