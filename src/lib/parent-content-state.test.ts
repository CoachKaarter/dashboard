import { test } from "node:test";
import assert from "node:assert/strict";
import { diffSnapshot, isMajorConvocationChange } from "./parent-content-state";

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
