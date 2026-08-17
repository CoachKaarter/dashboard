"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, canAccessTeam } from "@/lib/authz";

const KINDS = ["reunion", "tournoi", "autre"];

export async function createEvent(formData: FormData) {
  const user = await requireUser();
  const teamId = String(formData.get("teamId") || "") || null;
  if (teamId && !canAccessTeam(user, teamId)) return;

  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const date = new Date(String(formData.get("date")));
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const location = String(formData.get("location") || "") || null;
  const teamLabel = String(formData.get("teamLabel") || "").trim() || "Toutes";
  if (!title || !KINDS.includes(kind) || Number.isNaN(date.getTime()) || !startTime || !endTime) return;

  const event = await prisma.calendarEvent.create({
    data: { title, kind, date, startTime, endTime, location, teamId, teamLabel },
  });
  revalidatePath("/planning");
  revalidatePath("/");
  redirect(`/planning/${event.id}`);
}

async function assertEventAccess(eventId: string) {
  const user = await requireUser();
  const event = await prisma.calendarEvent.findUniqueOrThrow({ where: { id: eventId } });
  if (event.teamId && !canAccessTeam(user, event.teamId)) throw new Error("Accès refusé.");
  return { user, event };
}

export async function updateEvent(eventId: string, formData: FormData) {
  await assertEventAccess(eventId);
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const date = new Date(String(formData.get("date")));
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const location = String(formData.get("location") || "") || null;
  const teamLabel = String(formData.get("teamLabel") || "").trim() || "Toutes";
  if (!title || !KINDS.includes(kind) || Number.isNaN(date.getTime()) || !startTime || !endTime) return;

  await prisma.calendarEvent.update({
    where: { id: eventId },
    data: { title, kind, date, startTime, endTime, location, teamLabel },
  });
  revalidatePath("/planning");
  revalidatePath(`/planning/${eventId}`);
  revalidatePath("/");
}

export async function deleteEvent(eventId: string) {
  await assertEventAccess(eventId);
  await prisma.calendarEvent.delete({ where: { id: eventId } });
  revalidatePath("/planning");
  revalidatePath("/");
  redirect("/planning");
}
