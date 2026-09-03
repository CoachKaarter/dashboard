import { test } from "node:test";
import assert from "node:assert/strict";
import { isDeadlineSoon, isDeadlinePassed, matchDataFromInvitation } from "./tournament-invitation";

const NOW = new Date("2026-09-03T10:00:00.000Z"); // jeudi

test("isDeadlineSoon: null deadline n'est jamais proche", () => {
  assert.equal(isDeadlineSoon(null, NOW), false);
});

test("isDeadlineSoon: dans 2 jours -> proche (seuil 3 jours par défaut)", () => {
  assert.equal(isDeadlineSoon(new Date("2026-09-05T00:00:00.000Z"), NOW), true);
});

test("isDeadlineSoon: dans 10 jours -> pas proche", () => {
  assert.equal(isDeadlineSoon(new Date("2026-09-13T00:00:00.000Z"), NOW), false);
});

test("isDeadlineSoon: déjà dépassée -> aussi considérée proche (rien à gagner à attendre)", () => {
  assert.equal(isDeadlineSoon(new Date("2026-09-01T00:00:00.000Z"), NOW), true);
});

test("isDeadlinePassed: null deadline n'est jamais dépassée", () => {
  assert.equal(isDeadlinePassed(null, NOW), false);
});

test("isDeadlinePassed: hier -> dépassée", () => {
  assert.equal(isDeadlinePassed(new Date("2026-09-02T00:00:00.000Z"), NOW), true);
});

test("isDeadlinePassed: aujourd'hui -> pas encore dépassée", () => {
  assert.equal(isDeadlinePassed(new Date("2026-09-03T00:00:00.000Z"), NOW), false);
});

test("isDeadlinePassed: demain -> pas dépassée", () => {
  assert.equal(isDeadlinePassed(new Date("2026-09-04T00:00:00.000Z"), NOW), false);
});

test("matchDataFromInvitation: équipe U13 -> needed 12, competition Tournoi, opponent = club organisateur", () => {
  const invitation = { id: "inv1", organizingClub: "AS Sautron", date: new Date("2026-09-20T00:00:00.000Z"), location: "Complexe Sautron" };
  const team = { id: "team-u13a", category: "U13" };
  const data = matchDataFromInvitation(invitation, team);
  assert.deepEqual(data, {
    teamId: "team-u13a",
    opponent: "AS Sautron",
    competition: "Tournoi",
    date: invitation.date,
    location: "Complexe Sautron",
    isHome: false,
    status: "Planifié",
    needed: 12,
    tournamentInvitationId: "inv1",
  });
});

test("matchDataFromInvitation: équipe U12 -> needed 11", () => {
  const invitation = { id: "inv2", organizingClub: "FC Rezé", date: new Date("2026-10-04T00:00:00.000Z"), location: null };
  const team = { id: "team-u12b", category: "U12" };
  const data = matchDataFromInvitation(invitation, team);
  assert.equal(data.needed, 11);
  assert.equal(data.location, null);
});
