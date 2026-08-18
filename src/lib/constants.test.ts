import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMATIONS, FORMATIONS_BY_FORMAT } from "./constants";

// Cases 9/10 (§147) — Foot à 8 accepts exactly 8 titulaires (GK included),
// Foot à 11 exactly 11.
test("every Foot à 8 formation has exactly 8 positions (goalkeeper included)", () => {
  for (const key of FORMATIONS_BY_FORMAT["Foot à 8"]) {
    assert.equal(FORMATIONS[key]?.length, 8, `${key} should have 8 positions`);
  }
});

test("every Foot à 11 formation has exactly 11 positions (goalkeeper included)", () => {
  for (const key of FORMATIONS_BY_FORMAT["Foot à 11"]) {
    assert.equal(FORMATIONS[key]?.length, 11, `${key} should have 11 positions`);
  }
});

test("every formation listed in FORMATIONS_BY_FORMAT exists in FORMATIONS", () => {
  for (const keys of Object.values(FORMATIONS_BY_FORMAT)) {
    for (const key of keys) assert.ok(FORMATIONS[key], `missing FORMATIONS entry for ${key}`);
  }
});
