"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, requireAdmin, canAccessTeam, canManageCategory } from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { TRANSPORT_MODES } from "@/lib/equipment";

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

// Niveau de compétition (ex. "ELITE", "D1", "D3") — affiché sur la feuille
// de convocation comme "{category} {level}". Texte libre volontairement (le
// club nomme ses niveaux comme il veut), jamais déduit automatiquement.
export async function updateTeamLevel(teamId: string, formData: FormData) {
  const user = await requireUser();
  if (!canAccessTeam(user, teamId)) return;
  const level = String(formData.get("level") ?? "").trim() || null;
  await prisma.team.update({ where: { id: teamId }, data: { level } });
  revalidatePath("/equipes");
  revalidatePath(`/equipes/${teamId}`);
}

// Team creation isn't ADMIN-only: a Responsable de catégorie has genuine
// pilotage of their perimeter and shouldn't need an admin to create a team
// mid-season (e.g. Davy adding U9C). Non-admins are restricted to
// categories they actually manage — the UI only offers those as options,
// this is the server-side backstop.
export async function createTeam(formData: FormData) {
  const user = await requireUser();
  const code = String(formData.get("code") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const format = String(formData.get("format") ?? "");
  const rawTarget = String(formData.get("targetSize") ?? "").trim();
  if (!code || !category || !TEAM_FORMATS.includes(format)) return;
  if (user.role !== "ADMIN" && !canManageCategory(user, category)) redirect("/");
  const targetSize = rawTarget ? Number(rawTarget) : null;

  const team = await prisma.team.create({ data: { code, category, format, targetSize } });
  await logActivity({ actorId: user.id, summary: `a créé l'équipe ${team.code} (${team.category})`, entityType: "Team", entityId: team.id });
  revalidatePath("/equipes");
  redirect(`/equipes/${team.id}`);
}

// Valeurs par défaut de l'équipe pour les infos parents d'un match
// (héritage Match > MatchTemplate > Team > réglages généraux — voir
// src/lib/match-parent-info.ts). Contrairement à updateTeamLevel/
// updateTeamFormat (accès simple à l'équipe), régler des habitudes qui se
// répercutent automatiquement sur chaque futur match est un choix de
// pilotage de catégorie — réservé au Responsable de cette catégorie (ou
// l'ADMIN), pas à un Coach qui n'intervient que match par match.
export async function updateTeamDefaults(teamId: string, formData: FormData) {
  const user = await requireUser();
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { category: true } });
  if (!team) return;
  if (user.role !== "ADMIN" && !canManageCategory(user, team.category)) return;
  const intOrNull = (name: string) => {
    const raw = String(formData.get(name) ?? "").trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
  };
  const strOrNull = (name: string) => String(formData.get(name) ?? "").trim() || null;
  const transportRaw = String(formData.get("defaultTransportMode") ?? "");
  const defaultTransportMode = TRANSPORT_MODES.includes(transportRaw as (typeof TRANSPORT_MODES)[number]) ? transportRaw : null;

  await prisma.team.update({
    where: { id: teamId },
    data: {
      meetTimeDeltaMinutes: intOrNull("meetTimeDeltaMinutes"),
      defaultDurationMinutes: intOrNull("defaultDurationMinutes"),
      defaultReturnDelayMinutes: intOrNull("defaultReturnDelayMinutes"),
      defaultTransportMode,
      defaultDressCode: strOrNull("defaultDressCode"),
      defaultPersonalGear: strOrNull("defaultPersonalGear"),
      defaultMealInfo: strOrNull("defaultMealInfo"),
      defaultParentInstructions: strOrNull("defaultParentInstructions"),
    },
  });
  revalidatePath(`/equipes/${teamId}`);
}

export async function updateTeamCoach(teamId: string, formData: FormData) {
  await requireAdmin();
  const coachId = String(formData.get("coachId") || "") || null;
  await prisma.team.update({ where: { id: teamId }, data: { coachId } });
  revalidatePath("/equipes");
  revalidatePath(`/equipes/${teamId}`);
}
