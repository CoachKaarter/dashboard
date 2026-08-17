"use server";

import { parentSignOut } from "@/parent-auth";
import { requireParent, type AuthedParent } from "@/lib/parent-session";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWindowForWeek, upsertAvailability } from "@/lib/availability";
import { availabilityStatusSchema, absenceReasonSchema } from "@/lib/parent-validation";
import { revalidatePath } from "next/cache";
import type { TrainingSession } from "@/generated/prisma/client";

export async function parentSignOutAction() {
  await parentSignOut({ redirectTo: "/parent/login" });
}

// Server-side enforced, deliberately not just hidden in the UI: a request
// outside an OPEN window — including one still marked OPEN but past its own
// closesAt, which the staff simply hasn't clicked "Clôturer" for yet — is
// refused. §38 of the spec: closesAt alone must end write access, the
// status flag is a courtesy the staff sets, not the actual gate.
async function assertWindowOpenNow(weekStartDate: Date) {
  const window = await getWindowForWeek(weekStartDate);
  if (!window || window.status !== "OPEN") return false;
  const now = new Date();
  if (window.opensAt && now < window.opensAt) return false;
  if (window.closesAt && now > window.closesAt) return false;
  return true;
}

// A parent must only ever be able to answer for sessions that actually
// concern their own child's team/category — never trust a sessionId from
// the client alone. §37 of the spec.
function sessionInParentScope(session: TrainingSession, parent: AuthedParent) {
  if (session.scopeTeamId) return session.scopeTeamId === parent.player.teamId;
  return session.category === parent.player.teamCategory;
}

export async function setSessionAvailability(sessionId: string, statusRaw: string) {
  const parent = await requireParent();
  const parsed = availabilityStatusSchema.safeParse(statusRaw);
  if (!parsed.success) return;

  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session || !sessionInParentScope(session, parent)) return;
  const weekStart = getWeekStart(session.date);
  if (!(await assertWindowOpenNow(weekStart))) return;

  await upsertAvailability({
    playerId: parent.playerId,
    type: "TRAINING",
    sessionId,
    eventDate: session.date,
    weekStartDate: weekStart,
    status: parsed.data,
    answeredBy: "PARENT",
  });
  revalidatePath("/parent");
}

export async function setSessionAbsenceReason(sessionId: string, formData: FormData) {
  const parent = await requireParent();
  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session || !sessionInParentScope(session, parent)) return;
  const weekStart = getWeekStart(session.date);
  if (!(await assertWindowOpenNow(weekStart))) return;

  const reasonParsed = absenceReasonSchema.safeParse(formData.get("absenceReason"));
  const absenceReason = reasonParsed.success ? reasonParsed.data : null;
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

export async function setWeekendAvailability(weekStartIso: string, statusRaw: string) {
  const parent = await requireParent();
  const parsed = availabilityStatusSchema.safeParse(statusRaw);
  if (!parsed.success) return;

  const weekStart = new Date(weekStartIso);
  if (!(await assertWindowOpenNow(weekStart))) return;
  const eventDate = new Date(weekStart);
  eventDate.setDate(eventDate.getDate() + 5); // samedi

  await upsertAvailability({
    playerId: parent.playerId,
    type: "WEEKEND",
    sessionId: null,
    eventDate,
    weekStartDate: weekStart,
    status: parsed.data,
    answeredBy: "PARENT",
  });
  revalidatePath("/parent");
}

export async function setWeekendAbsenceReason(weekStartIso: string, formData: FormData) {
  const parent = await requireParent();
  const weekStart = new Date(weekStartIso);
  if (!(await assertWindowOpenNow(weekStart))) return;
  const eventDate = new Date(weekStart);
  eventDate.setDate(eventDate.getDate() + 5);

  const reasonParsed = absenceReasonSchema.safeParse(formData.get("absenceReason"));
  const absenceReason = reasonParsed.success ? reasonParsed.data : null;
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
