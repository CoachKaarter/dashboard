"use server";

import { parentSignOut } from "@/parent-auth";
import { requireParent } from "@/lib/parent-session";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWindowForWeek, upsertAvailability } from "@/lib/availability";
import { revalidatePath } from "next/cache";

export async function parentSignOutAction() {
  await parentSignOut({ redirectTo: "/parent/login" });
}

// Server-side enforced, deliberately not just hidden in the UI: even if a
// request is crafted directly, a session outside an OPEN window is refused.
async function assertWindowOpen(weekStartDate: Date) {
  const window = await getWindowForWeek(weekStartDate);
  return window?.status === "OPEN";
}

export async function setSessionAvailability(sessionId: string, status: "AVAILABLE" | "UNAVAILABLE") {
  const parent = await requireParent();
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session) return;
  const weekStart = getWeekStart(session.date);
  if (!(await assertWindowOpen(weekStart))) return;

  await upsertAvailability({
    playerId: parent.playerId,
    type: "TRAINING",
    sessionId,
    eventDate: session.date,
    weekStartDate: weekStart,
    status,
    answeredBy: "PARENT",
  });
  revalidatePath("/parent");
}

export async function setSessionAbsenceReason(sessionId: string, formData: FormData) {
  const parent = await requireParent();
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session) return;
  const weekStart = getWeekStart(session.date);
  if (!(await assertWindowOpen(weekStart))) return;

  const absenceReason = String(formData.get("absenceReason") || "") || null;
  const comment = String(formData.get("comment") || "").trim() || null;
  await upsertAvailability({
    playerId: parent.playerId,
    type: "TRAINING",
    sessionId,
    eventDate: session.date,
    weekStartDate: weekStart,
    status: "UNAVAILABLE",
    absenceReason,
    comment,
    answeredBy: "PARENT",
  });
  revalidatePath("/parent");
}

export async function setWeekendAvailability(weekStartIso: string, status: "AVAILABLE" | "UNAVAILABLE") {
  const parent = await requireParent();
  const weekStart = new Date(weekStartIso);
  if (!(await assertWindowOpen(weekStart))) return;
  const eventDate = new Date(weekStart);
  eventDate.setDate(eventDate.getDate() + 5); // samedi

  await upsertAvailability({
    playerId: parent.playerId,
    type: "WEEKEND",
    sessionId: null,
    eventDate,
    weekStartDate: weekStart,
    status,
    answeredBy: "PARENT",
  });
  revalidatePath("/parent");
}

export async function setWeekendAbsenceReason(weekStartIso: string, formData: FormData) {
  const parent = await requireParent();
  const weekStart = new Date(weekStartIso);
  if (!(await assertWindowOpen(weekStart))) return;
  const eventDate = new Date(weekStart);
  eventDate.setDate(eventDate.getDate() + 5);

  const absenceReason = String(formData.get("absenceReason") || "") || null;
  const comment = String(formData.get("comment") || "").trim() || null;
  await upsertAvailability({
    playerId: parent.playerId,
    type: "WEEKEND",
    sessionId: null,
    eventDate,
    weekStartDate: weekStart,
    status: "UNAVAILABLE",
    absenceReason,
    comment,
    answeredBy: "PARENT",
  });
  revalidatePath("/parent");
}
