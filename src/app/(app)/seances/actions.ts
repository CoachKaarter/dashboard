"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, canAccessSession, canAccessTeam } from "@/lib/authz";
import { logActivity } from "@/lib/activity";
import { assertPlayerInSessionScope } from "@/lib/session-scope";
import { isAttendanceCode, ensureSessionInProgress, canTerminateSession, playersNeedingDefaultPresence } from "@/lib/session-lifecycle";
import { ensureSessionExpectations, assertPlayerInSessionCategory } from "@/lib/session-expectation";

async function assertSessionAccess(sessionId: string) {
  const user = await requireUser();
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (!(await canAccessSession(user, session))) throw new Error("Accès refusé.");
  return { user, session };
}

async function scopePlayers(sessionId: string) {
  const session = await prisma.trainingSession.findUniqueOrThrow({ where: { id: sessionId } });
  return prisma.player.findMany({
    where: {
      archived: false,
      ...(session.scopeTeamId ? { teamId: session.scopeTeamId } : { category: session.category }),
    },
  });
}

export async function setAttendance(sessionId: string, playerId: string, code: string) {
  const { user, session } = await assertSessionAccess(sessionId);
  if (!isAttendanceCode(code)) throw new Error("Code de pointage invalide.");
  await assertPlayerInSessionScope(sessionId, playerId);
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
  await ensureSessionInProgress(session);
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath("/seances");
  revalidatePath("/");
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath("/coach/seances");
  revalidatePath("/coach");
}

export async function setAttendanceNote(sessionId: string, playerId: string, formData: FormData) {
  const { user } = await assertSessionAccess(sessionId);
  await assertPlayerInSessionScope(sessionId, playerId);
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
  const toCreate = playersNeedingDefaultPresence(players, done);
  const now = new Date();
  await prisma.attendance.createMany({
    data: toCreate.map((p) => ({ sessionId, playerId: p.id, code: "P", updatedById: user.id, updatedAt: now })),
  });
  await ensureSessionInProgress(session);
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
  await ensureSessionExpectations(session.id);
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
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath("/coach/seances");
  revalidatePath("/coach");
}

const RATINGS = ["Très difficile", "Difficile", "Correcte", "Bonne", "Très bonne"];

// The only door to "Réalisée" — a simple Attendance pointage no longer gets
// a session there on its own (see src/lib/session-lifecycle.ts). Blocked on
// an "Annulée" session so a stray/duplicate submit can't resurrect it.
export async function terminerSeance(sessionId: string, formData: FormData) {
  const { user, session } = await assertSessionAccess(sessionId);
  if (!canTerminateSession(session.status)) throw new Error("Cette séance est annulée.");
  const rating = String(formData.get("rating") || "");
  const comment = String(formData.get("comment") || "").trim();

  await prisma.trainingSession.update({ where: { id: sessionId }, data: { status: "Réalisée" } });

  const bilanParts = [rating && RATINGS.includes(rating) ? `ressenti : ${rating}` : null, comment || null].filter(Boolean);
  await logActivity({
    actorId: user.id,
    summary: `a terminé la séance ${session.category} du ${session.date.toLocaleDateString("fr-FR")}${
      bilanParts.length ? ` — ${bilanParts.join(" · ")}` : ""
    }`,
    entityType: "TrainingSession",
    entityId: sessionId,
  });

  revalidatePath(`/seances/${sessionId}`);
  revalidatePath("/seances");
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath("/coach/seances");
  revalidatePath("/coach");
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
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath("/coach/seances");
  revalidatePath("/coach");
}

export async function deleteSession(sessionId: string) {
  const { user, session } = await assertSessionAccess(sessionId);

  // ensureUpcomingSessions() (src/lib/recurring.ts) decides whether a session
  // was already generated purely by checking whether a row exists for that
  // (date, category, scopeTeam, startTime) — it has no memory of a row that
  // used to exist. So hard-deleting a session that matches an active
  // RecurringSlot gets it silently recreated the next time /seances loads.
  // Soft-deleting (deletedAt) instead keeps the row for that check — the
  // generator still sees it and skips regenerating it — while every display
  // query filters deletedAt: null, so it disappears from view exactly like a
  // real delete everywhere a person actually looks (Planning, séances list,
  // coach app).
  const regeneratedByTemplate = await prisma.recurringSlot.findFirst({
    where: {
      active: true,
      category: session.category,
      scopeTeamId: session.scopeTeamId,
      weekday: session.date.getDay(),
      startTime: session.startTime,
    },
  });

  if (regeneratedByTemplate) {
    await prisma.trainingSession.update({ where: { id: sessionId }, data: { status: "Annulée", deletedAt: new Date() } });
    await logActivity({
      actorId: user.id,
      summary: `a supprimé la séance ${session.category} du ${session.date.toLocaleDateString("fr-FR")} (conservée en interne pour éviter sa régénération par le modèle récurrent actif)`,
      entityType: "TrainingSession",
      entityId: sessionId,
    });
    revalidatePath(`/seances/${sessionId}`);
    revalidatePath("/seances");
    revalidatePath("/planning");
    revalidatePath("/");
    revalidatePath(`/coach/seances/${sessionId}`);
    revalidatePath("/coach/seances");
    revalidatePath("/coach");
    redirect("/seances");
  }

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
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath("/coach/seances");
  revalidatePath("/coach");
  redirect("/seances");
}

function revalidateExpectationViews(sessionId: string) {
  revalidatePath(`/seances/${sessionId}`);
  revalidatePath(`/coach/seances/${sessionId}`);
  revalidatePath("/coach");
  revalidatePath("/coach/seances");
  revalidatePath("/planning");
  revalidatePath("/");
}

// Bascule rapide (§5 du brief V6) — décision manuelle explicite, donc écrase
// volontairement une ligne existante, contrairement à ensureSessionExpectations.
export async function setExpected(sessionId: string, playerId: string, expected: boolean) {
  const { user } = await assertSessionAccess(sessionId);
  await assertPlayerInSessionCategory(sessionId, playerId);
  await prisma.sessionExpectation.upsert({
    where: { sessionId_playerId: { sessionId, playerId } },
    update: { expected, updatedById: user.id },
    create: { sessionId, playerId, expected, updatedById: user.id },
  });
  revalidateExpectationViews(sessionId);
}

// Action groupée (§6).
export async function setExpectedBulk(sessionId: string, playerIds: string[], expected: boolean) {
  const { user } = await assertSessionAccess(sessionId);
  for (const playerId of playerIds) {
    await assertPlayerInSessionCategory(sessionId, playerId);
  }
  await prisma.$transaction(
    playerIds.map((playerId) =>
      prisma.sessionExpectation.upsert({
        where: { sessionId_playerId: { sessionId, playerId } },
        update: { expected, updatedById: user.id },
        create: { sessionId, playerId, expected, updatedById: user.id },
      })
    )
  );
  revalidateExpectationViews(sessionId);
}

// Joueur exceptionnel (§4/§25) — scope CATÉGORIE large (pas équipe), utilisée
// depuis la fiche séance staff ET l'appel Coach mobile ("+ Ajouter un joueur
// non prévu"). Ne touche jamais Player.teamId ni le groupe habituel.
export async function addExceptionalExpectation(sessionId: string, playerId: string) {
  const { user } = await assertSessionAccess(sessionId);
  await assertPlayerInSessionCategory(sessionId, playerId);
  await prisma.sessionExpectation.upsert({
    where: { sessionId_playerId: { sessionId, playerId } },
    update: { expected: true, updatedById: user.id },
    create: { sessionId, playerId, expected: true, updatedById: user.id },
  });
  revalidateExpectationViews(sessionId);
}
