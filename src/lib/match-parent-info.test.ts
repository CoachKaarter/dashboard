import { test } from "node:test";
import assert from "node:assert/strict";
import { shiftTime, resolveMeetTime, resolveEstimatedEnd, resolveEstimatedReturn, resolveField, selectMatchTemplate, computeParentInfoCompleteness } from "./match-parent-info";

test("shiftTime: ajoute/retranche des minutes avec repli sur 24h", () => {
  assert.equal(shiftTime("10:30", -60), "09:30");
  assert.equal(shiftTime("00:10", -30), "23:40");
  assert.equal(shiftTime("23:50", 20), "00:10");
  assert.equal(shiftTime("10:30", 60), "11:30");
});

// §34 TEST 1 — l'équipe possède un délai de RDV habituel, aucun modèle.
test("TEST 1 : RDV = coup d'envoi - délai équipe quand aucun modèle n'est appliqué", () => {
  const r = resolveMeetTime({ kickoffTime: "10:30", override: null, templateDeltaMinutes: null, teamDeltaMinutes: 60, globalDeltaMinutes: 60 });
  assert.equal(r.value, "09:30");
  assert.equal(r.source, "team");
});

// §34 TEST 2 — le modèle (Tournoi, -75) prime sur le délai habituel de l'équipe (-60).
test("TEST 2 : le délai du modèle de match prime sur le délai habituel de l'équipe", () => {
  const r = resolveMeetTime({ kickoffTime: "10:30", override: null, templateDeltaMinutes: 75, teamDeltaMinutes: 60, globalDeltaMinutes: 60 });
  assert.equal(r.value, "09:15");
  assert.equal(r.source, "template");
});

// §34 TEST 3 — un override saisi manuellement sur le match prime sur tout le reste.
test("TEST 3 : un override explicite sur le Match prime sur le modèle et sur l'équipe", () => {
  const r = resolveMeetTime({ kickoffTime: "10:30", override: "08:45", templateDeltaMinutes: 75, teamDeltaMinutes: 60, globalDeltaMinutes: 60 });
  assert.equal(r.value, "08:45");
  assert.equal(r.source, "match");
});

test("resolveMeetTime: sans modèle ni équipe, retombe sur le réglage général du club", () => {
  const r = resolveMeetTime({ kickoffTime: "10:30", override: null, templateDeltaMinutes: null, teamDeltaMinutes: null, globalDeltaMinutes: 60 });
  assert.equal(r.value, "09:30");
  assert.equal(r.source, "global");
});

test("resolveMeetTime: sans coup d'envoi renseigné, rien à calculer", () => {
  const r = resolveMeetTime({ kickoffTime: null, override: null, templateDeltaMinutes: 60, teamDeltaMinutes: null, globalDeltaMinutes: 60 });
  assert.equal(r.value, null);
  assert.equal(r.source, "none");
});

test("resolveEstimatedEnd: aucun repli sur une durée générale du club — jamais de durée inventée", () => {
  const r = resolveEstimatedEnd({ kickoffTime: "10:30", override: null, templateDurationMinutes: null, teamDurationMinutes: null });
  assert.equal(r.value, null);
  assert.equal(r.source, "none");
});

test("resolveEstimatedEnd: modèle prime sur équipe, override prime sur tout", () => {
  const fromTeam = resolveEstimatedEnd({ kickoffTime: "10:30", override: null, templateDurationMinutes: null, teamDurationMinutes: 60 });
  assert.deepEqual(fromTeam, { value: "11:30", source: "team" });

  const fromTemplate = resolveEstimatedEnd({ kickoffTime: "10:30", override: null, templateDurationMinutes: 50, teamDurationMinutes: 60 });
  assert.deepEqual(fromTemplate, { value: "11:20", source: "template" });

  const overridden = resolveEstimatedEnd({ kickoffTime: "10:30", override: "12:00", templateDurationMinutes: 50, teamDurationMinutes: 60 });
  assert.deepEqual(overridden, { value: "12:00", source: "match" });
});

test("resolveEstimatedReturn: calculé à partir de la fin déjà résolue, jamais du coup d'envoi", () => {
  const r = resolveEstimatedReturn({ estimatedEnd: "11:30", override: null, templateReturnDelayMinutes: null, teamReturnDelayMinutes: 30 });
  assert.deepEqual(r, { value: "12:00", source: "team" });

  const none = resolveEstimatedReturn({ estimatedEnd: null, override: null, templateReturnDelayMinutes: 30, teamReturnDelayMinutes: 30 });
  assert.deepEqual(none, { value: null, source: "none" });
});

test("resolveField: priorité match > template > team, champs vides ignorés comme null", () => {
  assert.deepEqual(resolveField("Maillot bleu", "Tenue club", "Tenue équipe"), { value: "Maillot bleu", source: "match" });
  assert.deepEqual(resolveField(null, "Tenue club", "Tenue équipe"), { value: "Tenue club", source: "template" });
  assert.deepEqual(resolveField(null, null, "Tenue équipe"), { value: "Tenue équipe", source: "team" });
  assert.deepEqual(resolveField(null, null, null), { value: null, source: "none" });
  assert.deepEqual(resolveField("", "Tenue club", null), { value: "Tenue club", source: "template" });
});

const TEMPLATES = [
  { id: "1", name: "Championnat — Domicile", competition: "Championnat", isHome: true },
  { id: "2", name: "Championnat — Extérieur", competition: "Championnat", isHome: false },
  { id: "3", name: "Amical — Domicile", competition: "Amical", isHome: true },
  { id: "4", name: "Tournoi", competition: "Tournoi", isHome: null },
];

test("selectMatchTemplate: correspondance exacte competition + domicile/extérieur", () => {
  const t = selectMatchTemplate(TEMPLATES, { competition: "Championnat", isHome: false });
  assert.equal(t?.name, "Championnat — Extérieur");
});

test("selectMatchTemplate: un modèle 'toutes issues' (isHome: null) s'applique aux deux cas", () => {
  const home = selectMatchTemplate(TEMPLATES, { competition: "Tournoi", isHome: true });
  const away = selectMatchTemplate(TEMPLATES, { competition: "Tournoi", isHome: false });
  assert.equal(home?.name, "Tournoi");
  assert.equal(away?.name, "Tournoi");
});

test("selectMatchTemplate: aucune correspondance → aucun modèle imposé", () => {
  const t = selectMatchTemplate(TEMPLATES, { competition: "Coupe", isHome: true });
  assert.equal(t, null);
});

const EMPTY_PARENT_INFO = {
  meetTime: null,
  location: null,
  venueAddress: null,
  estimatedEndTime: null,
  estimatedReturnTime: null,
  transportMode: null,
  dressCode: null,
  personalGear: null,
  mealInfo: null,
  parentInstructions: null,
};

test("computeParentInfoCompleteness : rien de renseigné → 0 %", () => {
  const c = computeParentInfoCompleteness(EMPTY_PARENT_INFO);
  assert.deepEqual(c, { filled: 0, total: 9, percent: 0 });
});

test("computeParentInfoCompleteness : tout renseigné → 100 %", () => {
  const c = computeParentInfoCompleteness({
    ...EMPTY_PARENT_INFO,
    meetTime: "09:15",
    location: "Stade municipal",
    estimatedEndTime: "11:30",
    estimatedReturnTime: "12:00",
    transportMode: "COVOITURAGE",
    dressCode: "Tenue du club",
    personalGear: "Crampons",
    mealInfo: "Barre de céréales",
    parentInstructions: "Arriver 10 min avant",
  });
  assert.deepEqual(c, { filled: 9, total: 9, percent: 100 });
});

test("computeParentInfoCompleteness : location OU venueAddress compte pour un seul champ « lieu »", () => {
  const withLocationOnly = computeParentInfoCompleteness({ ...EMPTY_PARENT_INFO, location: "Stade municipal" });
  const withAddressOnly = computeParentInfoCompleteness({ ...EMPTY_PARENT_INFO, venueAddress: "1 rue du Stade" });
  const withBoth = computeParentInfoCompleteness({ ...EMPTY_PARENT_INFO, location: "Stade municipal", venueAddress: "1 rue du Stade" });
  assert.equal(withLocationOnly.filled, 1);
  assert.equal(withAddressOnly.filled, 1);
  assert.equal(withBoth.filled, 1);
});
