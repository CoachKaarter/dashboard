import { test } from "node:test";
import assert from "node:assert/strict";
import { nextStatusAfterFieldAction, canTerminateSession, playersNeedingDefaultPresence, isAttendanceCode } from "./session-lifecycle";

// Case 3 — an invalid Attendance code is refused.
test("isAttendanceCode: only P/R/AJ/ANJ/B are valid", () => {
  for (const code of ["P", "R", "AJ", "ANJ", "B"]) assert.equal(isAttendanceCode(code), true);
  assert.equal(isAttendanceCode("HACK"), false);
  assert.equal(isAttendanceCode(""), false);
});

// Case 4 — "Tout marquer présent" never overwrites an existing pointage.
test("playersNeedingDefaultPresence: skips players who already have an Attendance row", () => {
  const players = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
  const alreadyPointed = new Set(["p2"]); // p2 already has R/AJ/ANJ/B recorded
  const result = playersNeedingDefaultPresence(players, alreadyPointed);
  assert.deepEqual(result.map((p) => p.id), ["p1", "p3"]);
});

const today = new Date("2026-08-18T12:00:00.000Z");

// Case 5 — a first pointage no longer immediately marks the session "Réalisée".
test("nextStatusAfterFieldAction: a first pointage on a today/past 'Prévue' session moves it to 'En cours', never 'Réalisée'", () => {
  const session = { status: "Prévue", date: new Date("2026-08-18T00:00:00.000Z") };
  assert.equal(nextStatusAfterFieldAction(session, today), "En cours");
});

test("nextStatusAfterFieldAction: a pointage made in advance on a future session never changes status (présence prévisionnelle)", () => {
  const session = { status: "Prévue", date: new Date("2026-08-25T00:00:00.000Z") };
  assert.equal(nextStatusAfterFieldAction(session, today), null);
});

// Case 7 — correcting an Attendance on an already-"Réalisée" session stays "Réalisée".
test("nextStatusAfterFieldAction: never regresses an already-'Réalisée' session", () => {
  const session = { status: "Réalisée", date: new Date("2026-08-18T00:00:00.000Z") };
  assert.equal(nextStatusAfterFieldAction(session, today), null);
});

// An "Annulée" session must never be silently revived by a stray pointage.
test("nextStatusAfterFieldAction: never touches an 'Annulée' session", () => {
  const session = { status: "Annulée", date: new Date("2026-08-18T00:00:00.000Z") };
  assert.equal(nextStatusAfterFieldAction(session, today), null);
});

// Case 6 — "Terminer séance" -> "Réalisée" is the only door, blocked only for "Annulée".
test("canTerminateSession: allowed from 'Prévue', 'En cours', and even 'Réalisée' (idempotent close)", () => {
  assert.equal(canTerminateSession("Prévue"), true);
  assert.equal(canTerminateSession("En cours"), true);
  assert.equal(canTerminateSession("Réalisée"), true);
});

test("canTerminateSession: refused for 'Annulée' — a stray/duplicate submit can't resurrect it", () => {
  assert.equal(canTerminateSession("Annulée"), false);
});
