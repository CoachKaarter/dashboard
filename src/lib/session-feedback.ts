/**
 * Pre/post-séance questionnaire windows and perceived load. Deliberately
 * simple (no per-club configuration in V1, per spec §22/§27) — defaults:
 * pre-séance opens 14:00 same day, closes at kickoff; post-séance opens at
 * the session's end time, closes the next day at noon.
 */
import type { TrainingSession } from "@/generated/prisma/client";

function atTime(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function preWindow(session: TrainingSession) {
  const opens = new Date(session.date);
  opens.setHours(14, 0, 0, 0);
  const closes = atTime(session.date, session.startTime);
  return { opens, closes };
}

export function postWindow(session: TrainingSession) {
  const opens = atTime(session.date, session.endTime);
  const closes = new Date(session.date);
  closes.setDate(closes.getDate() + 1);
  closes.setHours(12, 0, 0, 0);
  return { opens, closes };
}

export function isPreOpen(session: TrainingSession, now = new Date()) {
  const { opens, closes } = preWindow(session);
  return now >= opens && now < closes;
}

export function isPostOpen(session: TrainingSession, now = new Date()) {
  const { opens, closes } = postWindow(session);
  return now >= opens && now < closes;
}

export function sessionDurationMinutes(session: TrainingSession) {
  const [sh, sm] = session.startTime.split(":").map(Number);
  const [eh, em] = session.endTime.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** SESSION LOAD = durée (minutes) × RPE — indicateur de tendance, pas une mesure médicale. */
export function computeLoad(session: TrainingSession, rpe: number) {
  return sessionDurationMinutes(session) * rpe;
}
