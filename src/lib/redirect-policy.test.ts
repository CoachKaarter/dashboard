import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideStaffMiddleware,
  decideParentMiddleware,
  decideLoginPageRedirect,
  decidePasswordChangeRedirect,
  decideOnboardingRedirect,
  sanitizeNextPath,
} from "./redirect-policy";

// --- STAFF ---

test("staff: no session on a protected route redirects to /login", () => {
  assert.deepEqual(decideStaffMiddleware("/", false), { type: "redirect", to: "/login" });
  assert.deepEqual(decideStaffMiddleware("/joueurs", false), { type: "redirect", to: "/login" });
});

test("staff: a decodable session on a protected route passes through", () => {
  assert.deepEqual(decideStaffMiddleware("/", true), { type: "next" });
});

test("staff: /login never redirects itself away — the anti-loop invariant", () => {
  // Covers both "JWT valid but User missing" and "User disabled + old JWT":
  // in both cases requireUser() sends the browser to /login with
  // isLoggedIn still true at the edge (the JWT itself still decodes).
  // If this ever returned a redirect, /login would bounce forever.
  assert.deepEqual(decideStaffMiddleware("/login", true), { type: "next" });
  assert.deepEqual(decideStaffMiddleware("/login", false), { type: "next" });
});

test("staff: a corrupted/undecodable JWT behaves like no session", () => {
  // Middleware sees isLoggedIn=false the same way it would for no cookie
  // at all — a decode failure never throws, it just fails closed.
  assert.deepEqual(decideStaffMiddleware("/", false), { type: "redirect", to: "/login" });
});

test("staff: public convocation share links bypass auth entirely", () => {
  assert.deepEqual(decideStaffMiddleware("/convocation/abc123", false), { type: "next" });
  assert.deepEqual(decideStaffMiddleware("/convocation/abc123", true), { type: "next" });
});

test("decideLoginPageRedirect: only a real, DB-confirmed user is sent to /", () => {
  assert.equal(decideLoginPageRedirect(true), "/");
  assert.equal(decideLoginPageRedirect(false), null);
});

test("staff: an unauthenticated /coach/* request is sent to /login carrying ?next= so the single login page can flavor itself and return there", () => {
  assert.deepEqual(decideStaffMiddleware("/coach", false), { type: "redirect", to: "/login?next=%2Fcoach" });
  assert.deepEqual(decideStaffMiddleware("/coach/seances/abc", false), {
    type: "redirect",
    to: "/login?next=%2Fcoach%2Fseances%2Fabc",
  });
});

test("decideLoginPageRedirect: an already-authed visit to /login?next=/coach lands back on /coach, not the Cockpit home", () => {
  assert.equal(decideLoginPageRedirect(true, "/coach/seances"), "/coach/seances");
  assert.equal(decideLoginPageRedirect(true, null), "/");
});

test("sanitizeNextPath: only a same-origin relative path survives — never an open redirect", () => {
  assert.equal(sanitizeNextPath("/coach"), "/coach");
  assert.equal(sanitizeNextPath("/coach/seances/abc"), "/coach/seances/abc");
  assert.equal(sanitizeNextPath(null), "/");
  assert.equal(sanitizeNextPath(undefined), "/");
  assert.equal(sanitizeNextPath(""), "/");
  assert.equal(sanitizeNextPath("coach"), "/");
  assert.equal(sanitizeNextPath("//evil.com"), "/");
  assert.equal(sanitizeNextPath("https://evil.com"), "/");
  assert.equal(sanitizeNextPath("/ok/../but-fine"), "/ok/../but-fine");
});

// --- PARENT ---

test("parent: no cookie on a protected route redirects to /parent/login", () => {
  assert.deepEqual(decideParentMiddleware("/parent", false), { type: "redirect", to: "/parent/login" });
  assert.deepEqual(decideParentMiddleware("/parent/planning", false), { type: "redirect", to: "/parent/login" });
});

test("parent: cookie present on a protected route passes through", () => {
  assert.deepEqual(decideParentMiddleware("/parent", true), { type: "next" });
});

test("parent: /parent/login never redirects itself away — the anti-loop invariant", () => {
  // Covers a stale/expired, disabled-account, or corrupted cookie: all of
  // them are still "present" from the middleware's point of view. Only
  // requireParent() (server-side, DB-backed) can tell them apart, and it
  // always sends failures back to this exact page.
  assert.deepEqual(decideParentMiddleware("/parent/login", true), { type: "next" });
  assert.deepEqual(decideParentMiddleware("/parent/login", false), { type: "next" });
});

test("parent: /parent/activation is reachable without a session cookie — that's the whole point of an invitation link", () => {
  assert.deepEqual(decideParentMiddleware("/parent/activation", false), { type: "next" });
  assert.deepEqual(decideParentMiddleware("/parent/activation/some-token", false), { type: "next" });
});

test("parent: /parent/reinitialiser (mot de passe oublié) is reachable without a session cookie", () => {
  assert.deepEqual(decideParentMiddleware("/parent/reinitialiser", false), { type: "next" });
  assert.deepEqual(decideParentMiddleware("/parent/reinitialiser/some-token", false), { type: "next" });
});

test("parent: /parent/mot-de-passe-oublie is reachable without a session cookie", () => {
  assert.deepEqual(decideParentMiddleware("/parent/mot-de-passe-oublie", false), { type: "next" });
});

test("decidePasswordChangeRedirect: forced first-login change never applies to itself", () => {
  assert.equal(decidePasswordChangeRedirect(true), "/parent/changer-mot-de-passe");
  assert.equal(decidePasswordChangeRedirect(false), null);
});

// --- STAFF ONBOARDING ---

test("decideOnboardingRedirect: a brand new account (never onboarded) is sent to /onboarding", () => {
  assert.equal(decideOnboardingRedirect(null), "/onboarding");
});

test("decideOnboardingRedirect: an account that already completed onboarding passes through", () => {
  assert.equal(decideOnboardingRedirect(new Date("2026-01-01")), null);
});
