import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAvailabilityCard,
  buildConvocationCard,
  buildConvocationWithdrawnCard,
  buildSessionCard,
  buildObjectiveCard,
  buildParentPriorityFeed,
  selectHero,
  type AvailabilityInput,
  type ConvocationInput,
  type SessionInput,
} from "./parent-priority";

const NOW = new Date("2026-08-27T10:00:00.000Z"); // jeudi

function availability(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    weekStartIso: "2026-08-24T00:00:00.000Z",
    windowStatus: "OPEN",
    closesAt: new Date("2026-08-28T20:00:00.000Z"),
    totalSlots: 2,
    answeredCount: 0,
    isNew: false,
    now: NOW,
    ...overrides,
  };
}

function convocation(overrides: Partial<ConvocationInput> = {}): ConvocationInput {
  return {
    id: "conv-1",
    matchId: "match-1",
    teamCode: "U13C",
    opponent: "FC Sautron",
    isHome: true,
    date: new Date("2026-08-29T00:00:00.000Z"), // samedi
    time: "10:00",
    meetTime: "09:00",
    meetLocation: null,
    location: "Stade Municipal de Sautron",
    matchStatus: "Planifié",
    scoreFor: null,
    scoreAgainst: null,
    confirmed: null,
    isNew: false,
    changes: [],
    requiresReconfirmation: false,
    now: NOW,
    ...overrides,
  };
}

function session(overrides: Partial<SessionInput> = {}): SessionInput {
  return {
    id: "sess-1",
    date: NOW,
    startTime: "18:15",
    endTime: "19:45",
    location: "La Profondine",
    status: "Prévue",
    isNew: false,
    timeChange: null,
    now: NOW,
    ...overrides,
  };
}

// ---------------------------------------------------------------------
// Cycle 1 — Disponibilités
// ---------------------------------------------------------------------

test("availability: fenêtre jamais ouverte (État A) ne produit aucune carte", () => {
  assert.equal(buildAvailabilityCard(availability({ windowStatus: "CLOSED" })), null);
});

test("availability: ouverture, rien répondu (État B) — action requise, CTA principal", () => {
  const card = buildAvailabilityCard(availability({ isNew: true }));
  assert.equal(card?.priorityType, "AVAILABILITY_OPEN");
  assert.equal(card?.priorityLevel, "P1");
  assert.equal(card?.isNew, true);
  assert.equal(card?.cta?.label, "Renseigner les disponibilités");
});

test("availability: partiellement répondu (État C) — CTA Continuer", () => {
  const card = buildAvailabilityCard(availability({ answeredCount: 1, totalSlots: 4 }));
  assert.equal(card?.priorityType, "AVAILABILITY_PARTIAL");
  assert.equal(card?.title, "1 sur 4 renseignées");
  assert.equal(card?.cta?.label, "Continuer");
});

test("availability: tout répondu (État D) — redescend vite, CTA secondaire Modifier", () => {
  const card = buildAvailabilityCard(availability({ answeredCount: 2, totalSlots: 2 }));
  assert.equal(card?.priorityType, "AVAILABILITY_COMPLETE");
  assert.equal(card?.priorityLevel, "P4");
  assert.equal(card?.secondaryCta?.label, "Modifier");
});

test("availability: deadline le jour même (État E) — priorité haute même si déjà partiellement répondu", () => {
  const closesAt = new Date(NOW.getTime() + 3 * 60 * 60 * 1000); // dans 3h
  const card = buildAvailabilityCard(availability({ answeredCount: 1, totalSlots: 2, closesAt }));
  assert.equal(card?.priorityType, "AVAILABILITY_DEADLINE_SOON");
  assert.equal(card?.priorityLevel, "P1");
});

test("availability: clôturée, encore incomplète (État F, modifiable) — pas de CTA inutilisable une fois totalement close", () => {
  const late = buildAvailabilityCard(availability({ windowStatus: "LOCKED", answeredCount: 1, totalSlots: 2 }));
  assert.equal(late?.priorityType, "AVAILABILITY_LATE");
  assert.ok(late?.cta);

  const closed = buildAvailabilityCard(availability({ windowStatus: "LOCKED", answeredCount: 2, totalSlots: 2 }));
  assert.equal(closed?.priorityType, "AVAILABILITY_CLOSED");
  assert.equal(closed?.cta, undefined);
  assert.equal(closed?.title, "Disponibilités clôturées");
});

// ---------------------------------------------------------------------
// Cycle 3 — Convocation
// ---------------------------------------------------------------------

test("convocation: publiée, jamais vue — NOUVELLE CONVOCATION", () => {
  const card = buildConvocationCard(convocation({ isNew: true, confirmed: null }));
  assert.equal(card?.priorityType, "CONVOCATION_NEW");
  assert.equal(card?.priorityLevel, "P1");
  assert.equal(card?.isNew, true);
  assert.match(card!.description!, /U13C/);
});

test("convocation: vue mais toujours sans réponse — reste action requise (perd juste le libellé Nouvelle)", () => {
  const card = buildConvocationCard(convocation({ isNew: false, confirmed: null }));
  assert.equal(card?.priorityType, "CONVOCATION_PENDING");
  assert.equal(card?.priorityLevel, "P1");
  assert.equal(card?.isNew, false);
});

test("convocation: présence confirmée (COMPLETED) — ne montre plus 'Réponse attendue', match lointain donc priorité basse", () => {
  const card = buildConvocationCard(convocation({ confirmed: true, date: new Date("2026-09-15T00:00:00.000Z") }));
  assert.notEqual(card?.priorityType, "CONVOCATION_PENDING");
  assert.equal(card?.priorityType, "CONVOCATION_CONFIRMED");
  assert.equal(card?.priorityLevel, "P4");
});

test("convocation: absence renseignée — CTA Modifier ma réponse, plus traité comme action en attente", () => {
  const card = buildConvocationCard(convocation({ confirmed: false }));
  assert.equal(card?.priorityType, "CONVOCATION_DECLINED");
  assert.equal(card?.cta?.label, "Modifier ma réponse");
});

test("convocation: modification majeure (horaire) — CONVOCATION MODIFIÉE, priorité maximale, redemande confirmation", () => {
  const card = buildConvocationCard(
    convocation({
      confirmed: true,
      changes: [{ field: "time", from: "10:00", to: "13:00" }],
      requiresReconfirmation: true,
    })
  );
  assert.equal(card?.priorityType, "CONVOCATION_MODIFIED_MAJOR");
  assert.equal(card?.priorityLevel, "P0");
  assert.match(card!.description!, /Nouvel horaire/);
  assert.match(card!.description!, /13:00/);
  assert.match(card!.description!, /10:00/);
});

test("convocation: modification mineure (lieu de rendez-vous) — réponse conservée, pas de reconfirmation", () => {
  const card = buildConvocationCard(
    convocation({
      confirmed: true,
      changes: [{ field: "meetLocation", from: "Parking club", to: "Stade" }],
      requiresReconfirmation: false,
    })
  );
  assert.equal(card?.priorityType, "CONVOCATION_MODIFIED_MINOR");
  assert.equal(card?.priorityLevel, "P3");
});

test("convocation: retirée — jamais silencieuse, reste NEW tant que non lue", () => {
  const card = buildConvocationWithdrawnCard({ isNew: true, hasReplacement: false });
  assert.equal(card.priorityType, "CONVOCATION_WITHDRAWN");
  assert.equal(card.priorityLevel, "P1");
  assert.match(card.detail!, /Pas de convocation ce week-end/);
});

test("convocation: match terminé — résultat informatif, redescend en priorité", () => {
  const card = buildConvocationCard(convocation({ matchStatus: "Joué", scoreFor: 4, scoreAgainst: 2, confirmed: true }));
  assert.equal(card?.priorityType, "MATCH_FINISHED");
  assert.equal(card?.priorityLevel, "P3");
  assert.match(card!.description!, /4 — 2/);
  assert.equal(card?.detail, "Victoire");
});

test("convocation: aujourd'hui, confirmée — devient prioritaire même sans action requise", () => {
  const card = buildConvocationCard(convocation({ confirmed: true, date: NOW }));
  assert.equal(card?.priorityType, "MATCH_TODAY");
  assert.equal(card?.priorityLevel, "P2");
});

test("convocation: demain, confirmée — info pratique, plus 'action requise'", () => {
  const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
  const card = buildConvocationCard(convocation({ confirmed: true, date: tomorrow }));
  assert.equal(card?.priorityType, "MATCH_TOMORROW");
  assert.equal(card?.priorityLevel, "P2");
});

// ---------------------------------------------------------------------
// Cycle 7-9 — Séance
// ---------------------------------------------------------------------

test("séance annulée le jour même — priorité maximale", () => {
  const card = buildSessionCard(session({ status: "Annulée", date: NOW }));
  assert.equal(card?.priorityType, "SESSION_CANCELLED");
  assert.equal(card?.priorityLevel, "P0");
});

test("séance modifiée (horaire) — met en avant l'ancien et le nouvel horaire", () => {
  const card = buildSessionCard(session({ timeChange: { from: "17:30", to: "18:00" } }));
  assert.equal(card?.priorityType, "SESSION_MODIFIED");
  assert.match(card!.description!, /18:00/);
  assert.match(card!.detail!, /17:30/);
});

// ---------------------------------------------------------------------
// Scénarios obligatoires (spec) — sélection du Hero unique
// ---------------------------------------------------------------------

test("scénario: disponibilités ouvertes + match dans 5 jours (aucune carte) → Hero = disponibilités", () => {
  const avail = buildAvailabilityCard(availability({ isNew: true }));
  const far = buildConvocationCard(convocation({ confirmed: true, date: new Date(NOW.getTime() + 5 * 86400000) }));
  // Un match à 5 jours n'est ni aujourd'hui ni demain : CONVOCATION_CONFIRMED, priorité P4 — jamais devant une action requise.
  const { hero } = buildParentPriorityFeed([avail, far]);
  assert.equal(hero?.priorityType, "AVAILABILITY_OPEN");
});

test("scénario: convocation NEW + disponibilités déjà complètes → Hero = convocation", () => {
  const avail = buildAvailabilityCard(availability({ answeredCount: 2, totalSlots: 2 }));
  const conv = buildConvocationCard(convocation({ isNew: true, confirmed: null }));
  const { hero } = buildParentPriorityFeed([avail, conv]);
  assert.equal(hero?.priorityType, "CONVOCATION_NEW");
});

test("scénario: séance annulée aujourd'hui + convocation à confirmer samedi → Hero = annulation", () => {
  const cancelled = buildSessionCard(session({ status: "Annulée", date: NOW }));
  const conv = buildConvocationCard(convocation({ isNew: true, confirmed: null, date: new Date("2026-08-29T00:00:00.000Z") }));
  const { hero } = buildParentPriorityFeed([cancelled, conv]);
  assert.equal(hero?.priorityType, "SESSION_CANCELLED");
});

test("scénario: match aujourd'hui + nouvel objectif → Hero = match", () => {
  const match = buildConvocationCard(convocation({ confirmed: true, date: NOW }));
  const objective = buildObjectiveCard({ id: "obj-1", title: "Travailler le une-deux", isNew: true });
  const { hero } = buildParentPriorityFeed([match, objective]);
  assert.equal(hero?.priorityType, "MATCH_TODAY");
});

test("annulation le jour même outrank un nouvel objectif ET un match dans 3 jours", () => {
  const cancelled = buildSessionCard(session({ status: "Annulée", date: NOW }));
  const objective = buildObjectiveCard({ id: "obj-1", title: "Placement défensif", isNew: true });
  const farMatch = buildConvocationCard(convocation({ confirmed: true, date: new Date(NOW.getTime() + 3 * 86400000) }));
  const { hero } = buildParentPriorityFeed([cancelled, objective, farMatch]);
  assert.equal(hero?.priorityType, "SESSION_CANCELLED");
});

test("aucun candidat → pas de Hero inventé (état calme géré par l'appelant)", () => {
  const { hero } = buildParentPriorityFeed([null, undefined, buildAvailabilityCard(availability({ windowStatus: "CLOSED" }))]);
  assert.equal(hero, null);
});

test("selectHero ignore les candidats null/undefined et reste déterministe à niveau égal", () => {
  const a = buildObjectiveCard({ id: "1", title: "A", isNew: true });
  const b = buildObjectiveCard({ id: "2", title: "B", isNew: true });
  assert.equal(selectHero([null, a, undefined, b]), a);
});
