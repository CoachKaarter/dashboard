import { test } from "node:test";
import assert from "node:assert/strict";
import { diffSnapshot, isMajorConvocationChange, convocationSnapshot } from "./parent-content-state";

test("diffSnapshot: aucun instantané connu (jamais vu/répondu) → pas de changement, c'est un NEW pas un MODIFIED", () => {
  assert.deepEqual(diffSnapshot(null, { time: "10:00" }), []);
});

test("diffSnapshot: valeur identique → pas de changement", () => {
  assert.deepEqual(diffSnapshot({ time: "10:00" }, { time: "10:00" }), []);
});

test("diffSnapshot: valeur différente → un changement rapporté avec from/to", () => {
  assert.deepEqual(diffSnapshot({ time: "10:00" }, { time: "13:00" }), [{ field: "time", from: "10:00", to: "13:00" }]);
});

test("diffSnapshot: plusieurs champs, seuls ceux qui ont changé sont rapportés", () => {
  const changes = diffSnapshot({ time: "10:00", meetLocation: "Parking" }, { time: "10:00", meetLocation: "Stade" });
  assert.deepEqual(changes, [{ field: "meetLocation", from: "Parking", to: "Stade" }]);
});

test("isMajorConvocationChange: horaire de coup d'envoi = changement majeur → reconfirmation exigée", () => {
  assert.equal(isMajorConvocationChange([{ field: "time", from: "10:00", to: "13:00" }]), true);
});

test("isMajorConvocationChange: date ou adversaire = changement majeur", () => {
  assert.equal(isMajorConvocationChange([{ field: "date", from: "a", to: "b" }]), true);
  assert.equal(isMajorConvocationChange([{ field: "opponent", from: "a", to: "b" }]), true);
});

test("isMajorConvocationChange: lieu de rendez-vous seul = changement mineur → réponse conservée", () => {
  assert.equal(isMajorConvocationChange([{ field: "meetLocation", from: "a", to: "b" }]), false);
  assert.equal(isMajorConvocationChange([{ field: "meetTime", from: "a", to: "b" }]), false);
  assert.equal(isMajorConvocationChange([{ field: "location", from: "a", to: "b" }]), false);
});

// Infos pratiques héritées (Team/MatchTemplate) — un transport ou une tenue
// modifiée doit apparaître comme "modifié" (§22) mais reste mineur : la
// réponse déjà donnée par le parent n'est pas invalidée pour autant.
test("convocationSnapshot: couvre les infos pratiques héritées, absentes si non fournies", () => {
  const withExtras = convocationSnapshot({
    date: new Date("2026-09-06T00:00:00Z"),
    time: "10:00",
    opponent: "US Rivale",
    meetTime: "09:15",
    meetLocation: null,
    location: "Stade municipal",
    transportMode: "COVOITURAGE",
    dressCode: "Tenue du club",
  });
  assert.equal(withExtras.transportMode, "COVOITURAGE");
  assert.equal(withExtras.dressCode, "Tenue du club");
  assert.equal(withExtras.mealInfo, null);
});

test("isMajorConvocationChange: transport/tenue/matériel modifiés = changement mineur", () => {
  const changes = [
    { field: "transportMode", from: "RDV_SUR_PLACE", to: "COVOITURAGE" },
    { field: "dressCode", from: "a", to: "b" },
    { field: "mealInfo", from: "a", to: "b" },
  ];
  assert.equal(isMajorConvocationChange(changes), false);
});
