/**
 * Pre/post-séance questionnaire windows and perceived load. Deliberately
 * simple (no per-club configuration in V1, per spec §22/§27) — defaults:
 * pre-séance opens 14:00 same day, closes at kickoff; post-séance opens at
 * the session's end time, closes the next day at noon. All wall-clock
 * times are Europe/Paris (src/lib/timezone.ts) — a server-local setHours()
 * would be wrong on Vercel, which runs in UTC.
 */
import type { TrainingSession } from "@/generated/prisma/client";
import { parisDateAtTime } from "@/lib/timezone";
import { addDays as parisAddDays } from "@/lib/availability";

function atParisTime(date: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return parisDateAtTime(date, h, m);
}

export function preWindow(session: TrainingSession) {
  const opens = parisDateAtTime(session.date, 14, 0);
  const closes = atParisTime(session.date, session.startTime);
  return { opens, closes };
}

export function postWindow(session: TrainingSession) {
  const opens = atParisTime(session.date, session.endTime);
  const closes = parisDateAtTime(parisAddDays(session.date, 1), 12, 0);
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
