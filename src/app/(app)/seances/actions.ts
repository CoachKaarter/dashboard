"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, canAccessSession, canAccessTeam } from "@/lib/authz";
import { logActivity } from "@/lib/activity";

async function assertSessionAccess(sessionId: string) {
  const user = await requireUser();
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!(await canAccessSession(user, session))) throw new Error("Accès refusé.");
  return { user, session };
}

async function scopePlayers(sessionId: string) {
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  return prisma.player.findMany({
    where: session.scopeTeamId ? { teamId: session.scopeTeamId } : { team: { category: session.category } },
  });
}

// Marking attendance on a session that hasn't happened yet is "présence
// prévisionnelle" — anticipated absences a coach already knows about — and
// must not flip the session to "Réalisée" the way real post-séance pointage
// does. Only sessions dated today or earlier count as actually pointed.
function isPastOrToday(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
}

export async function setAttendance(sessionId: string, playerId: string, code: string) {
  const { user, session } = await assertSessionAccess(sessionId);
  const existing = await prisma.attendance.findUnique({
    where: { sessionId_playerId: { sessionId, playerId } },
  });
  const now = new Date();
  // arrivalTime is the real instant of THIS tap — only meaningful for "R"
  // (used to compute the delay against TrainingSession.startTime), cleared
  // for every other code so switching a player away from "R" doesn't leave
  // a stale arrival time behind.
  if (existing?.code === code) {
    await prisma.attendance.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.attendance.update({
      where: { id: existing.id },
      data: { code, arrivalTime: code === "R" ? now : null, updatedById: user.id, updatedAt: now },
    });
  } else {
    await prisma.attendance.create({
      data: { sessionId, playerId, code, arrivalTime: code === "R" ? now : null, updatedById: user.id, updatedAt: now },
    });
  }
  if (isPastOrToday(session.date)) {
    await prisma.trainingSession.update({ where: { id: sessionId }, data: { status: "Réalisée" } });
  }
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath("/seances");
  revalidatePath("/");
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath("/coach/seances");
  revalidatePath("/coach");
}

export async function setAttendanceNote(sessionId: string, playerId: string, formData: FormData) {
  const { user } = await assertSessionAccess(sessionId);
  const note = String(formData.get("note") || "").trim() || null;
  const now = new Date();
  await prisma.attendance.upsert({
    where: { sessionId_playerId: { sessionId, playerId } },
    update: { note, updatedById: user.id, updatedAt: now },
    create: { sessionId, playerId, code: "AJ", note, updatedById: user.id, updatedAt: now },
  });
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath(`/coach/seances/${sessionId}`);
}

export async function markAllPresent(sessionId: string) {
  const { user, session } = await assertSessionAccess(sessionId);
  const players = await scopePlayers(sessionId);
  const existing = await prisma.attendance.findMany({ where: { sessionId }, select: { playerId: true } });
  const done = new Set(existing.map((e) => e.playerId));
  // Only players with NO existing Attendance row get "P" — never overwrites
  // an AJ/ANJ/R/B a coach already recorded (§11 of the coach mobile spec).
  const toCreate = players.filter((p) => !done.has(p.id));
  const now = new Date();
  await prisma.attendance.createMany({
    data: toCreate.map((p) => ({ sessionId, playerId: p.id, code: "P", updatedById: user.id, updatedAt: now })),
  });
  if (isPastOrToday(session.date)) {
    await prisma.trainingSession.update({ where: { id: sessionId }, data: { status: "Réalisée" } });
  }
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath("/seances");
  revalidatePath("/");
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath("/coach/seances");
  revalidatePath("/coach");
}

export async function resetPresence(sessionId: string) {
  await assertSessionAccess(sessionId);
  await prisma.attendance.deleteMany({ where: { sessionId } });
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath("/seances");
  revalidatePath("/");
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath("/coach/seances");
  revalidatePath("/coach");
}

export async function createSession(formData: FormData) {
  const user = await requireUser();
  const category = String(formData.get("category"));
  const scopeTeamId = String(formData.get("scopeTeamId") || "") || null;
  if (scopeTeamId && !canAccessTeam(user, scopeTeamId)) return;
  const label = String(formData.get("label"));
  const date = new Date(String(formData.get("date")));
  const startTime = String(formData.get("startTime"));
  const endTime = String(formData.get("endTime"));
  const location = String(formData.get("location"));
  const theme = String(formData.get("theme") || "").trim() || null;
  const objective = String(formData.get("objective") || "").trim() || null;

  const session = await prisma.trainingSession.create({
    data: { category, scopeTeamId, label, date, startTime, endTime, location, theme, objective, status: "Prévue" },
  });
  revalidatePath("/seances");
  revalidatePath("/planning");
  revalidatePath("/");
  redirect(`/seances/${session.id}`);
}

export async function updateSession(sessionId: string, formData: FormData) {
  await assertSessionAccess(sessionId);
  const label = String(formData.get("label"));
  const date = new Date(String(formData.get("date")));
  const startTime = String(formData.get("startTime"));
  const endTime = String(formData.get("endTime"));
  const location = String(formData.get("location"));
  const theme = String(formData.get("theme") || "").trim() || null;
  const objective = String(formData.get("objective") || "").trim() || null;
  if (!label || !startTime || !endTime || !location) return;

  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { label, date, startTime, endTime, location, theme, objective },
  });
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath("/seances");
  revalidatePath("/planning");
  revalidatePath("/");
}

export async function cancelSession(sessionId: string) {
  const { user, session } = await assertSessionAccess(sessionId);
  await prisma.trainingSession.update({ where: { id: sessionId }, data: { status: "Annulée" } });
  await logActivity({
    actorId: user.id,
    summary: `a annulé la séance ${session.category} du ${session.date.toLocaleDateString("fr-FR")}`,
    entityType: "TrainingSession",
    entityId: sessionId,
  });
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath("/seances");
  revalidatePath("/planning");
  revalidatePath("/");
}

export async function deleteSession(sessionId: string) {
  const { user, session } = await assertSessionAccess(sessionId);
  await prisma.trainingSession.delete({ where: { id: sessionId } });
  await logActivity({
    actorId: user.id,
    summary: `a supprimé la séance ${session.category} du ${session.date.toLocaleDateString("fr-FR")}`,
    entityType: "TrainingSession",
    entityId: sessionId,
  });
  revalidatePath("/seances");
  revalidatePath("/planning");
  revalidatePath("/");
  redirect("/seances");
}
