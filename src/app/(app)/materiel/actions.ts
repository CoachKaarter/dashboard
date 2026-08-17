"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { getSettings } from "@/lib/settings";

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export async function createJersey(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get("teamId") ?? "");
  if (!canAccessTeam(user, teamId)) return;
  const code = String(formData.get("code") ?? "").trim();
  const playerId = String(formData.get("playerId") || "") || null;
  const responsible = String(formData.get("responsible") ?? "").trim();
  if (!code || !responsible) return;

  const settings = await getSettings();
  const issuedDate = new Date();
  await prisma.jersey.create({
    data: {
      code,
      teamId,
      playerId,
      responsible,
      issuedDate,
      dueDate: addDays(issuedDate, settings.delaiMaillots),
      condition: "Bon",
    },
  });
  revalidatePath("/materiel");
}

async function assertJerseyAccess(jerseyId: string) {
  const user = await requireUser();
  const jersey = await prisma.jersey.findUniqueOrThrow({ where: { id: jerseyId } });
  if (!canAccessTeam(user, jersey.teamId)) throw new Error("Accès refusé.");
  return jersey;
}

export async function markReturned(jerseyId: string) {
  await assertJerseyAccess(jerseyId);
  await prisma.jersey.update({ where: { id: jerseyId }, data: { returnedDate: new Date() } });
  revalidatePath("/materiel");
}

export async function updateCondition(jerseyId: string, formData: FormData) {
  await assertJerseyAccess(jerseyId);
  const condition = String(formData.get("condition") ?? "");
  if (!["Bon", "À laver", "Abîmé"].includes(condition)) return;
  await prisma.jersey.update({ where: { id: jerseyId }, data: { condition } });
  revalidatePath("/materiel");
}

export async function reassignJersey(jerseyId: string, formData: FormData) {
  await assertJerseyAccess(jerseyId);
  const playerId = String(formData.get("playerId") || "") || null;
  const responsible = String(formData.get("responsible") ?? "").trim();
  if (!responsible) return;
  const settings = await getSettings();
  const issuedDate = new Date();
  await prisma.jersey.update({
    where: { id: jerseyId },
    data: { playerId, responsible, issuedDate, dueDate: addDays(issuedDate, settings.delaiMaillots), returnedDate: null },
  });
  revalidatePath("/materiel");
}

export async function deleteJersey(jerseyId: string) {
  await assertJerseyAccess(jerseyId);
  await prisma.jersey.delete({ where: { id: jerseyId } });
  revalidatePath("/materiel");
}
