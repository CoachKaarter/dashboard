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

// CAS 1 — option "Inclure les résultats du week-end" désactivée : le bloc
// résultats (titre compris) ne doit pas apparaître, aucune ligne vide en
// trop, aucune variable brute.
test("availability template: resultats disabled produces a clean message with no results block", () => {
  const out = renderMessageTemplate(DEFAULT_AVAILABILITY_MESSAGE_TEMPLATE, {
    date_limite: "jeudi 20h",
    lien_parent: "https://example.test/parent",
    resultats: "", // option OFF (ou aucun résultat exploitable — CAS 8)
  });
  assert.ok(!out.includes("Voici les résultats"));
  assert.ok(!out.includes("{{"));
  assert.ok(!out.includes("\n\n\n"));
  assert.equal(
    out,
    [
      "Bonjour à tous,",
      "",
      "Les disponibilités pour la semaine à venir sont désormais ouvertes.",
      "",
      "Vous pouvez dès à présent renseigner la présence de votre enfant aux séances ainsi que sa disponibilité pour le prochain week-end directement depuis l'espace parents :",
      "",
      "https://example.test/parent",
      "",
      "Merci de compléter les informations avant jeudi 20h afin de nous permettre d'organiser au mieux les séances et les équipes du week-end.",
      "",
      "Bonne semaine à tous.",
      "",
      "Le staff U12/U13 🔵🔵",
    ].join("\n")
  );
});

// CAS 2 — option activée avec des résultats : le bloc apparaît avec les 3
// lignes attendues, encadrées par le titre et suivies du reste du message.
test("availability template: resultats enabled injects the results block with its title", () => {
  const resultats = [
    "U13A — Victoire 4-2 vs Châteaubriant",
    "U13B — Match nul 2-2 vs Sucé-sur-Erdre",
    "U13C — Défaite 1-3 vs Sautron",
  ].join("\n");
  const out = renderMessageTemplate(DEFAULT_AVAILABILITY_MESSAGE_TEMPLATE, {
    date_limite: "jeudi 20h",
    lien_parent: "https://example.test/parent",
    resultats,
  });
  assert.ok(!out.includes("{{"));
  assert.ok(out.includes("Voici les résultats du week-end :"));
  assert.ok(out.includes("U13A — Victoire 4-2 vs Châteaubriant"));
  assert.ok(out.includes("U13B — Match nul 2-2 vs Sucé-sur-Erdre"));
  assert.ok(out.includes("U13C — Défaite 1-3 vs Sautron"));
  // Le titre précède bien les résultats, qui précèdent bien la suite du message.
  const titleIndex = out.indexOf("Voici les résultats");
  const resultsIndex = out.indexOf("U13A — Victoire");
  const nextParagraphIndex = out.indexOf("Les disponibilités pour la semaine");
  assert.ok(titleIndex < resultsIndex);
  assert.ok(resultsIndex < nextParagraphIndex);
});
