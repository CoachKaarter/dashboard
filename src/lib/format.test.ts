import { test } from "node:test";
import assert from "node:assert/strict";
import { formationLabel } from "./format";

test("formationLabel: strips the leading '1-' (goalkeeper) prefix", () => {
  assert.equal(formationLabel("1-3-3-1"), "3-3-1");
  assert.equal(formationLabel("1-4-3-3"), "4-3-3");
});

test("formationLabel: renders the losange suffix as a separate word", () => {
  assert.equal(formationLabel("1-4-4-2-losange"), "4-4-2 losange");
});
