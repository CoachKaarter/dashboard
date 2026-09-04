import { test } from "node:test";
import assert from "node:assert/strict";
import {
  playersNeedingExpectationInit,
  playerInSessionCategory,
  computeRosterSummary,
  shouldPromptForSessionAvailability,
} from "./session-expectation";

test("playersNeedingExpectationInit: ignore les joueurs qui ont déjà une ligne", () => {
  const players = [{ id: "p1" }, { id: "p2" }, { id: "p3" }];
  const out = playersNeedingExpectationInit(players, new Set(["p1", "p3"]));
  assert.deepEqual(out.map((p) => p.id), ["p2"]);
});

test("playersNeedingExpectationInit: liste vide quand tout le monde a déjà une ligne", () => {
  const players = [{ id: "p1" }, { id: "p2" }];
  assert.deepEqual(playersNeedingExpectationInit(players, new Set(["p1", "p2"])), []);
});

test("playerInSessionCategory: même catégorie, équipe différente de scopeTeamId — autorisé (ajout exceptionnel)", () => {
  const session = { scopeTeamId: "team-u13a", category: "U13" };
  const player = { archived: false, category: "U13" };
  assert.equal(playerInSessionCategory(session, player), true);
});

test("playerInSessionCategory: catégorie différente — refusé", () => {
  const session = { scopeTeamId: null, category: "U13" };
  const player = { archived: false, category: "U12" };
  assert.equal(playerInSessionCategory(session, player), false);
});

test("playerInSessionCategory: joueur archivé — toujours refusé même si bonne catégorie", () => {
  const session = { scopeTeamId: null, category: "U13" };
  const player = { archived: true, category: "U13" };
  assert.equal(playerInSessionCategory(session, player), false);
});

test("computeRosterSummary: 27 attendus, 23 annoncés présents, 3 annoncés absents, 1 sans réponse (§40)", () => {
  const expected = Array.from({ length: 27 }, (_, i) => ({ playerId: `p${i}`, expected: true }));
  const notExpected = [{ playerId: "x1", expected: false }, { playerId: "x2", expected: false }];
  const availabilities = [
    ...Array.from({ length: 23 }, (_, i) => ({ playerId: `p${i}`, status: "AVAILABLE" as const })),
    ...Array.from({ length: 3 }, (_, i) => ({ playerId: `p${23 + i}`, status: "UNAVAILABLE" as const })),
    // p26 has no availability row -> sans réponse
  ];
  const summary = computeRosterSummary([...expected, ...notExpected], availabilities);
  assert.deepEqual(summary, { expected: 27, announcedPresent: 23, announcedAbsent: 3, noResponse: 1 });
});

test("computeRosterSummary: un joueur non attendu n'est jamais compté, même avec une réponse famille", () => {
  const expectations = [{ playerId: "p1", expected: false }];
  const availabilities = [{ playerId: "p1", status: "UNAVAILABLE" as const }];
  assert.deepEqual(computeRosterSummary(expectations, availabilities), {
    expected: 0,
    announcedPresent: 0,
    announcedAbsent: 0,
    noResponse: 0,
  });
});

test("shouldPromptForSessionAvailability: non attendu -> jamais de sollicitation", () => {
  assert.equal(shouldPromptForSessionAvailability({ status: "Prévue" }, false), false);
});

test("shouldPromptForSessionAvailability: attendu et séance annulée -> jamais de sollicitation", () => {
  assert.equal(shouldPromptForSessionAvailability({ status: "Annulée" }, true), false);
});

test("shouldPromptForSessionAvailability: attendu et séance prévue -> sollicitation normale", () => {
  assert.equal(shouldPromptForSessionAvailability({ status: "Prévue" }, true), true);
});

test("shouldPromptForSessionAvailability: expected undefined (pas encore de ligne) traité comme attendu par défaut", () => {
  assert.equal(shouldPromptForSessionAvailability({ status: "Prévue" }, undefined), true);
});
