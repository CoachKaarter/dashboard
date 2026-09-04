"use server";

import { parentSignOut } from "@/parent-auth";
import { requireParent, ACTIVE_CHILD_COOKIE } from "@/lib/parent-session";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWeekendDate, getWindowForWeek, upsertAvailability } from "@/lib/availability";
import { availabilityStatusSchema, absenceReasonSchema } from "@/lib/parent-validation";
import { sessionInParentScope } from "@/lib/parent-scope";
import { recordSeen, recordSeenSnapshot, sessionSnapshot } from "@/lib/parent-content-state";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeNextPath } from "@/lib/redirect-policy";

// Bascule l'enfant actif — jamais confiance dans le playerId soumis, on ne
// pose le cookie que s'il appartient réellement à un enfant de ce compte.
// Le cookie n'est qu'une préférence d'affichage (pas de secret dedans), un
// simple cookie non httpOnly conviendrait, mais httpOnly reste la valeur
// par défaut la plus sûre ici, sans downside : rien ne le lit côté client.
export async function setActiveChildAction(formData: FormData) {
  const parent = await requireParent();
  const playerId = String(formData.get("playerId") || "");
  const redirectTo = sanitizeNextPath(String(formData.get("redirectTo") || "/parent"));
  if (!parent.children.some((c) => c.id === playerId)) redirect(redirectTo);

  const store = await cookies();
  store.set(ACTIVE_CHILD_COOKIE, playerId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(redirectTo);
}

/**
 * Accueil Parent v2 — éteint l'animation NEW une fois pour toutes (le
 * parent vient de voir cette carte en Hero). Ne touche jamais lastSnapshot
 * pour une convocation vue sans réponse : seule confirmMyConvocation
 * (planning/actions.ts) ancre une nouvelle version comme "répondue" — voir
 * le commentaire en tête de src/lib/parent-content-state.ts. Le serveur
 * recalcule lui-même l'instantané des séances/annonces à partir de la
 * base — jamais un JSON envoyé par le client.
 */
export async function markParentContentSeen(entityType: string, entityId: string) {
  const parent = await requireParent();
  const ref = { entityType, entityId };

  if (entityType === "TRAINING_SESSION") {
    const session = await prisma.trainingSession.findUnique({ where: { id: entityId } });
    if (!session || !sessionInParentScope(session, parent)) return;
    await recordSeenSnapshot(parent.parentAccountId, parent.activePlayerId, ref, sessionSnapshot(session));
    return;
  }

  if (entityType === "CONVOCATION") {
    const weekend = new Date(entityId);
    if (Number.isNaN(weekend.getTime())) return;
    const live = await prisma.matchConvocation.findFirst({ where: { playerId: parent.activePlayerId, match: { date: weekend } } });
    if (live) {
      await recordSeen(parent.parentAccountId, parent.activePlayerId, ref);
    } else {
      // Rien de vivant ce week-end : la carte affichée était un retrait —
      // l'acquitter pour de bon (sinon elle réapparaîtrait indéfiniment).
      await recordSeenSnapshot(parent.parentAccountId, parent.activePlayerId, ref, { withdrawn: "true" });
    }
    return;
  }

  if (
    entityType === "AVAILABILITY_WEEK" ||
    entityType === "ANNOUNCEMENT" ||
    entityType === "OBJECTIVE" ||
    entityType === "OBJECTIVE_UPDATE" ||
    entityType === "EQUIPMENT_ASSIGNMENT"
  ) {
    await recordSeen(parent.parentAccountId, parent.activePlayerId, ref);
  }
}

// Cockpit v1.1 §7 — déclaratif uniquement : passe le prêt à
// RETOUR_SIGNALE_PARENT, jamais RECUPERE_STAFF. Seul le staff, depuis le
// Cockpit (markEquipmentRecovered), peut clôturer définitivement le prêt
// et faire disparaître le rappel — voir src/app/(app)/materiel/actions.ts.
export async function reportEquipmentReturned(assignmentId: string) {
  const parent = await requireParent();
  const assignment = await prisma.equipmentAssignment.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.parentAccountId !== parent.parentAccountId) return;
  if (assignment.status === "RECUPERE_STAFF") return;

  await prisma.equipmentAssignment.update({ where: { id: assignmentId }, data: { status: "RETOUR_SIGNALE_PARENT", parentReportedAt: new Date() } });
  revalidatePath("/parent");
  revalidatePath("/materiel");
  revalidatePath("/");
}

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

export async function setSessionAvailability(sessionId: string, statusRaw: string) {
  const parent = await requireParent();
  const parsed = availabilityStatusSchema.safeParse(statusRaw);
  if (!parsed.success) return;

  const session = await prisma.trainingSession.findUnique({ where: { id: sessionId } });
  if (!session || !sessionInParentScope(session, parent)) return;
  const weekStart = getWeekStart(session.date);
  if (!(await assertWindowOpenNow(weekStart))) return;

  await upsertAvailability({
    playerId: parent.activePlayerId,
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
    playerId: parent.activePlayerId,
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
  const eventDate = getWeekendDate(weekStart);

  await upsertAvailability({
    playerId: parent.activePlayerId,
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
  const eventDate = getWeekendDate(weekStart);

  const reasonParsed = absenceReasonSchema.safeParse(formData.get("absenceReason"));
  const absenceReason = reasonParsed.success ? reasonParsed.data : null;
  const comment = String(formData.get("comment") || "").trim() || null;
  await upsertAvailability({
    playerId: parent.activePlayerId,
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
