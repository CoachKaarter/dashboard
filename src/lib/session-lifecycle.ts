/**
 * Pré-V5 hardening (Partie D) — TrainingSession lifecycle.
 *
 * Prévue → En cours → Réalisée, plus the terminal Annulée. A simple
 * Attendance pointage no longer silently finishes a session ("Terminer la
 * séance" is the only door to "Réalisée") — it only proves the session is
 * genuinely underway, so the first real terrain action (pointage, or
 * starting the first SessionBlock) moves a same-day-or-past session from
 * "Prévue" to "En cours". A pointage made in advance on a future session
 * (présence prévisionnelle) never touches status. Once "Réalisée", nothing
 * here regresses it back to "En cours". "Annulée" is never touched by this
 * helper — only an explicit un-annulation (not offered by the product)
 * could move it, so a stray pointage on a cancelled session can't revive it.
 *
 * Decisions are plain, DB-free functions so they're directly unit-testable
 * (no live database needed in this environment); `ensureSessionInProgress`
 * is a thin fetch-then-decide wrapper around `nextStatusAfterFieldAction`.
 */
import { prisma } from "@/lib/prisma";

export const ATTENDANCE_CODES = ["P", "R", "AJ", "ANJ", "B"] as const;
export type AttendanceCode = (typeof ATTENDANCE_CODES)[number];

export function isAttendanceCode(value: string): value is AttendanceCode {
  return (ATTENDANCE_CODES as readonly string[]).includes(value);
}

export function isPastOrToday(date: Date, today: Date = new Date()) {
  const cutoff = new Date(today);
  cutoff.setHours(0, 0, 0, 0);
  return date <= cutoff;
}

/** Pure decision — no DB access — so it's directly unit-testable. */
export function nextStatusAfterFieldAction(session: { status: string; date: Date }, today: Date = new Date()): string | null {
  if (session.status !== "Prévue") return null;
  if (!isPastOrToday(session.date, today)) return null;
  return "En cours";
}

export async function ensureSessionInProgress(session: { id: string; status: string; date: Date }) {
  const next = nextStatusAfterFieldAction(session);
  if (!next) return;
  await prisma.trainingSession.update({ where: { id: session.id }, data: { status: next } });
}

/** Pure decision — the only status "Terminer la séance" must refuse to touch. */
export function canTerminateSession(status: string): boolean {
  return status !== "Annulée";
}

/** Pure decision — "Tout marquer présent" must never overwrite an existing pointage. */
export function playersNeedingDefaultPresence<T extends { id: string }>(players: T[], alreadyPointedPlayerIds: Set<string>): T[] {
  return players.filter((p) => !alreadyPointedPlayerIds.has(p.id));
}
