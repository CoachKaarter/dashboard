"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function scopePlayers(sessionId: string) {
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  return prisma.player.findMany({
    where: session.scopeTeamId ? { teamId: session.scopeTeamId } : { team: { category: session.category } },
  });
}

export async function setAttendance(sessionId: string, playerId: string, code: string) {
  const existing = await prisma.attendance.findUnique({
    where: { sessionId_playerId: { sessionId, playerId } },
  });
  if (existing?.code === code) {
    await prisma.attendance.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.attendance.update({ where: { id: existing.id }, data: { code } });
  } else {
    await prisma.attendance.create({ data: { sessionId, playerId, code } });
  }
  await prisma.trainingSession.update({ where: { id: sessionId }, data: { status: "Réalisée" } });
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath("/seances");
  revalidatePath("/");
}

export async function markAllPresent(sessionId: string) {
  const players = await scopePlayers(sessionId);
  const existing = await prisma.attendance.findMany({ where: { sessionId }, select: { playerId: true } });
  const done = new Set(existing.map((e) => e.playerId));
  const toCreate = players.filter((p) => !done.has(p.id));
  await prisma.attendance.createMany({
    data: toCreate.map((p) => ({ sessionId, playerId: p.id, code: "P" })),
  });
  await prisma.trainingSession.update({ where: { id: sessionId }, data: { status: "Réalisée" } });
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath("/seances");
  revalidatePath("/");
}

export async function resetPresence(sessionId: string) {
  await prisma.attendance.deleteMany({ where: { sessionId } });
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath("/seances");
  revalidatePath("/");
}

export async function createSession(formData: FormData) {
  const category = String(formData.get("category"));
  const scopeTeamId = String(formData.get("scopeTeamId") || "") || null;
  const label = String(formData.get("label"));
  const date = new Date(String(formData.get("date")));
  const startTime = String(formData.get("startTime"));
  const endTime = String(formData.get("endTime"));
  const location = String(formData.get("location"));

  const session = await prisma.trainingSession.create({
    data: { category, scopeTeamId, label, date, startTime, endTime, location, status: "Prévue" },
  });
  revalidatePath("/seances");
  revalidatePath("/planning");
  revalidatePath("/");
  redirect(`/seances/${session.id}`);
}
