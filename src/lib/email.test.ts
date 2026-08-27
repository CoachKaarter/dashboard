import { test } from "node:test";
import assert from "node:assert/strict";
import { buildParentInvitationEmail, buildParentPasswordResetEmail } from "./email";

const invitationBase = {
  to: "famille@example.test",
  clubName: "Saint-Sébastien FC",
  playerFirstName: "Léo",
  playerLastName: "Dupont",
  activationUrl: "https://onzevo.website/parent/activation/abc123",
};

test("buildParentInvitationEmail: subject matches the specified copy", () => {
  const { subject } = buildParentInvitationEmail(invitationBase);
  assert.equal(subject, "Votre espace famille Onzevo est prêt");
});

test("buildParentInvitationEmail: names the club and the child (last name uppercased, as specified)", () => {
  const { text, html } = buildParentInvitationEmail(invitationBase);
  assert.match(text, /Saint-Sébastien FC/);
  assert.match(text, /Léo DUPONT/);
  assert.match(html, /Léo DUPONT/);
});

test("buildParentInvitationEmail: carries the activation link (button + fallback text) and its 72h validity", () => {
  const { text, html } = buildParentInvitationEmail(invitationBase);
  assert.match(text, /https:\/\/onzevo\.website\/parent\/activation\/abc123/);
  assert.match(html, /href="https:\/\/onzevo\.website\/parent\/activation\/abc123"/);
  assert.match(text, /72 heures/);
  assert.match(html, /72 heures/);
});

test("buildParentInvitationEmail: never contains a password, temp password, or hash-shaped field", () => {
  const { text, html } = buildParentInvitationEmail(invitationBase);
  for (const s of [text, html]) {
    assert.doesNotMatch(s.toLowerCase(), /mot de passe temporaire/);
    assert.doesNotMatch(s.toLowerCase(), /identifiant/);
  }
});

test("buildParentInvitationEmail: header uses the real hosted Onzevo logo", () => {
  const { html } = buildParentInvitationEmail(invitationBase);
  assert.match(html, /<img src="https:\/\/onzevo\.website\/onzevo-logo-light\.png"/);
});

test("buildParentInvitationEmail: falls back to the club name (text) when no club logo is configured", () => {
  const { html } = buildParentInvitationEmail(invitationBase);
  assert.match(html, /Saint-Sébastien FC/);
});

test("buildParentInvitationEmail: uses the club logo image when provided", () => {
  const { html } = buildParentInvitationEmail({ ...invitationBase, clubLogoUrl: "https://onzevo.website/api/club/logo?v=123" });
  assert.match(html, /<img src="https:\/\/onzevo\.website\/api\/club\/logo\?v=123"/);
});

test("buildParentInvitationEmail: HTML-escapes club/player names", () => {
  const { html } = buildParentInvitationEmail({ ...invitationBase, clubName: "AS <Test> & Co", playerFirstName: "O'Brien" });
  assert.doesNotMatch(html, /<Test>/);
  assert.match(html, /AS &lt;Test&gt; &amp; Co/);
  assert.match(html, /O&#39;Brien/);
});

test("buildParentInvitationEmail: footer never mentions a password", () => {
  const { html } = buildParentInvitationEmail(invitationBase);
  assert.doesNotMatch(html.toLowerCase(), /mot de passe/);
});

const resetBase = {
  to: "famille@example.test",
  clubName: "Saint-Sébastien FC",
  resetUrl: "https://onzevo.website/parent/reinitialiser/xyz789",
};

test("buildParentPasswordResetEmail: subject matches the specified copy", () => {
  const { subject } = buildParentPasswordResetEmail(resetBase);
  assert.equal(subject, "Réinitialisez votre mot de passe Onzevo");
});

test("buildParentPasswordResetEmail: carries the reset link and its 30-minute validity, never the old password", () => {
  const { text, html } = buildParentPasswordResetEmail(resetBase);
  assert.match(text, /https:\/\/onzevo\.website\/parent\/reinitialiser\/xyz789/);
  assert.match(html, /href="https:\/\/onzevo\.website\/parent\/reinitialiser\/xyz789"/);
  assert.match(text, /30 minutes/);
  assert.doesNotMatch(text.toLowerCase(), /ancien mot de passe/);
});
