import { test } from "node:test";
import assert from "node:assert/strict";
import { pickForeground, relativeLuminance, contrastRatio } from "./contrast";

test("pickForeground: near-black text on a light/yellow background", () => {
  assert.equal(pickForeground("#FFFF00"), "#16181C");
});

test("pickForeground: white text on a near-black background", () => {
  assert.equal(pickForeground("#111111"), "#FFFFFF");
});

test("pickForeground: the app's own default green actually reads better with dark text (WCAG contrast ~5.3:1 vs ~4.0:1 for white)", () => {
  assert.equal(pickForeground("#3F8F5B"), "#16181C");
});

test("pickForeground: white text on a clearly dark, saturated blue", () => {
  assert.equal(pickForeground("#1A3D6D"), "#FFFFFF");
});

test("pickForeground: invalid input falls back to dark text rather than crashing", () => {
  assert.equal(pickForeground("not-a-color"), "#16181C");
});

test("relativeLuminance: pure white is 1, pure black is 0", () => {
  assert.equal(relativeLuminance("#FFFFFF"), 1);
  assert.equal(relativeLuminance("#000000"), 0);
});

test("contrastRatio: identical luminances have a ratio of 1", () => {
  assert.equal(contrastRatio(0.5, 0.5), 1);
});

test("contrastRatio: black vs white is the maximum possible ratio (21:1)", () => {
  assert.ok(Math.abs(contrastRatio(0, 1) - 21) < 0.01);
});
