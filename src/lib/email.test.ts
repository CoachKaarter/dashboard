import { test } from "node:test";
import assert from "node:assert/strict";
import { buildParentCredentialsEmail } from "./email";

const base = {
  to: "famille@example.test",
  clubName: "Saint-Sébastien FC",
  playerFirstName: "Léo",
  playerLastName: "Dupont",
  username: "leo.dupont",
  tempPassword: "aB3xY9kLmZ",
};

test("buildParentCredentialsEmail: subject names the club", () => {
  const { subject } = buildParentCredentialsEmail(base);
  assert.match(subject, /Saint-Sébastien FC/);
});

test("buildParentCredentialsEmail: plain-text body carries the real identifiant/mot de passe and the login link", () => {
  const { text } = buildParentCredentialsEmail(base);
  assert.match(text, /leo\.dupont/);
  assert.match(text, /aB3xY9kLmZ/);
  assert.match(text, /https:\/\/onzevo\.website\/parent\/login/);
  assert.match(text, /Léo Dupont/);
});

test("buildParentCredentialsEmail: HTML body carries the same credentials", () => {
  const { html } = buildParentCredentialsEmail(base);
  assert.match(html, /leo\.dupont/);
  assert.match(html, /aB3xY9kLmZ/);
  assert.match(html, /href="https:\/\/onzevo\.website\/parent\/login"/);
});

test("buildParentCredentialsEmail: HTML-escapes player/club names so a stray '&' or '<' in data never breaks markup", () => {
  const { html } = buildParentCredentialsEmail({ ...base, clubName: "AS <Test> & Co", playerFirstName: "O'Brien" });
  assert.doesNotMatch(html, /<Test>/);
  assert.match(html, /AS &lt;Test&gt; &amp; Co/);
  assert.match(html, /O&#39;Brien/);
});
