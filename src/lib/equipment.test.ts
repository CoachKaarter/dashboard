import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEquipmentDisplayStatus, daysLate } from "./equipment";

const NOW = new Date("2026-09-02T10:00:00.000Z"); // mercredi

test("computeEquipmentDisplayStatus: aucune attribution active -> à attribuer", () => {
  assert.equal(computeEquipmentDisplayStatus(null, NOW), "A_ATTRIBUER");
});

test("computeEquipmentDisplayStatus: chez le joueur, échéance future -> chez le joueur", () => {
  const status = computeEquipmentDisplayStatus({ status: "CHEZ_LE_JOUEUR", dueDate: new Date("2026-09-10T00:00:00.000Z") }, NOW);
  assert.equal(status, "CHEZ_LE_JOUEUR");
});

test("computeEquipmentDisplayStatus: échéance aujourd'hui -> retour aujourd'hui", () => {
  const status = computeEquipmentDisplayStatus({ status: "CHEZ_LE_JOUEUR", dueDate: new Date("2026-09-02T00:00:00.000Z") }, NOW);
  assert.equal(status, "RETOUR_AUJOURD_HUI");
});

test("computeEquipmentDisplayStatus: échéance passée -> en retard", () => {
  const status = computeEquipmentDisplayStatus({ status: "CHEZ_LE_JOUEUR", dueDate: new Date("2026-08-28T00:00:00.000Z") }, NOW);
  assert.equal(status, "EN_RETARD");
});

test("computeEquipmentDisplayStatus: retour signalé par le parent reste 'retour signalé' même en retard", () => {
  const status = computeEquipmentDisplayStatus({ status: "RETOUR_SIGNALE_PARENT", dueDate: new Date("2026-08-20T00:00:00.000Z") }, NOW);
  assert.equal(status, "RETOUR_SIGNALE_PARENT");
});

test("computeEquipmentDisplayStatus: récupéré par le staff reste récupéré même si passé par 'active' par erreur", () => {
  const status = computeEquipmentDisplayStatus({ status: "RECUPERE_STAFF", dueDate: new Date("2026-08-20T00:00:00.000Z") }, NOW);
  assert.equal(status, "RECUPERE_STAFF");
});

test("daysLate: 0 si pas en retard", () => {
  assert.equal(daysLate({ status: "CHEZ_LE_JOUEUR", dueDate: new Date("2026-09-10T00:00:00.000Z") }, NOW), 0);
});

test("daysLate: nombre de jours entiers de retard", () => {
  assert.equal(daysLate({ status: "CHEZ_LE_JOUEUR", dueDate: new Date("2026-08-28T00:00:00.000Z") }, NOW), 5);
});
