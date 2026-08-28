import { test } from "node:test";
import assert from "node:assert/strict";
import { computePlayerCardRating, abbreviatePosition, KNOWN_POSITIONS } from "./player-card";

test("computePlayerCardRating: aucune évaluation → pas de carte (jamais inventée)", () => {
  assert.equal(computePlayerCardRating(null), null);
});

test("computePlayerCardRating: 1/5 partout → 40 partout, jamais 0", () => {
  const r = computePlayerCardRating({ technique: 1, tactique: 1, physique: 1, comportement: 1 });
  assert.equal(r?.overall, 40);
  for (const s of r!.stats) assert.equal(s.value, 40);
});

test("computePlayerCardRating: 5/5 partout → 99 partout, jamais 100", () => {
  const r = computePlayerCardRating({ technique: 5, tactique: 5, physique: 5, comportement: 5 });
  assert.equal(r?.overall, 99);
  for (const s of r!.stats) assert.equal(s.value, 99);
});

test("computePlayerCardRating: 3/5 (milieu du barème) → milieu de l'échelle d'affichage", () => {
  const r = computePlayerCardRating({ technique: 3, tactique: 3, physique: 3, comportement: 3 });
  // (40 + 99) / 2 = 69.5, arrondi à 70 (formule linéaire, ratio 0.5 exact)
  assert.equal(r?.overall, 70);
});

test("computePlayerCardRating: valeurs mixtes → overall = moyenne des 4 axes convertis, pas la moyenne brute reconvertie", () => {
  const r = computePlayerCardRating({ technique: 5, tactique: 1, physique: 3, comportement: 3 });
  const values = r!.stats.map((s) => s.value);
  assert.deepEqual(values, [99, 40, 70, 70]);
  assert.equal(r!.overall, Math.round((99 + 40 + 70 + 70) / 4));
});

test("computePlayerCardRating: clampe les valeurs hors barème (défensif, ne devrait pas arriver via l'UI)", () => {
  const tooLow = computePlayerCardRating({ technique: 0, tactique: 1, physique: 1, comportement: 1 });
  const tooHigh = computePlayerCardRating({ technique: 10, tactique: 5, physique: 5, comportement: 5 });
  assert.equal(tooLow?.stats[0].value, 40);
  assert.equal(tooHigh?.stats[0].value, 99);
});

test("computePlayerCardRating: chaque axe garde son étiquette (technique/tactique/physique/comportement)", () => {
  const r = computePlayerCardRating({ technique: 4, tactique: 3, physique: 2, comportement: 5 });
  assert.deepEqual(
    r!.stats.map((s) => s.key),
    ["technique", "tactique", "physique", "comportement"]
  );
  assert.deepEqual(
    r!.stats.map((s) => s.label),
    ["TEC", "TAC", "PHY", "MEN"]
  );
});

test("abbreviatePosition: chaque poste connu a une abréviation dédiée", () => {
  for (const p of KNOWN_POSITIONS) {
    const abbr = abbreviatePosition(p);
    assert.ok(abbr.length > 0 && abbr.length <= 3, `abréviation trop longue pour ${p} : ${abbr}`);
  }
});

test("abbreviatePosition: poste inconnu retombe sur les 3 premières lettres en majuscules", () => {
  assert.equal(abbreviatePosition("Piston"), "PIS");
});
