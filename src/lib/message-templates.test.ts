import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderMessageTemplate,
  DEFAULT_AVAILABILITY_MESSAGE_TEMPLATE,
  DEFAULT_CONVOCATION_MESSAGE_TEMPLATE,
} from "./message-templates";

test("renderMessageTemplate substitutes every occurrence of a placeholder", () => {
  const out = renderMessageTemplate("{{a}} et {{a}} puis {{b}}", { a: "X", b: "Y" });
  assert.equal(out, "X et X puis Y");
});

test("renderMessageTemplate leaves an unmapped placeholder untouched", () => {
  const out = renderMessageTemplate("Bonjour {{prenom}}", {});
  assert.equal(out, "Bonjour {{prenom}}");
});

test("default availability template resolves cleanly with its documented variables", () => {
  const out = renderMessageTemplate(DEFAULT_AVAILABILITY_MESSAGE_TEMPLATE, {
    date_limite: "le 26 août à 12h00",
    lien_parent: "https://example.test/parent",
  });
  assert.ok(!out.includes("{{"));
  assert.ok(out.includes("le 26 août à 12h00"));
  assert.ok(out.includes("https://example.test/parent"));
});

test("default convocation template resolves cleanly with its documented variables", () => {
  const out = renderMessageTemplate(DEFAULT_CONVOCATION_MESSAGE_TEMPLATE, {
    date: "29 août",
    lien_parent: "https://example.test/parent",
    lien_club: "https://ssfc.fr/",
  });
  assert.ok(!out.includes("{{"));
  assert.ok(out.includes("29 août"));
  assert.ok(out.includes("https://ssfc.fr/"));
});
