/**
 * Pure routing decisions shared by src/proxy.ts (middleware) and the two
 * login-adjacent pages. Kept separate from NextRequest/NextResponse so the
 * anti-loop invariant — a login page never redirects itself away — is
 * directly unit-testable without a live DB or an edge runtime.
 *
 * The middleware functions only ever see "does the JWT decode" (staff) or
 * "is a cookie present" (parent) — never "is this account still active in
 * the DB". That real check happens in requireUser()/requireParent() on
 * every protected page, which is why a login page must always resolve to
 * "next": it's the only page those guards are allowed to redirect to
 * without risking a bounce straight back.
 */
export type RouteDecision = { type: "next" } | { type: "redirect"; to: string };

export function decideStaffMiddleware(pathname: string, isLoggedIn: boolean): RouteDecision {
  const isLoginPage = pathname.startsWith("/login");
  // Convocation share links are handed to players/parents who have no
  // account — deliberately public, gated only by the unguessable token.
  const isPublicShare = pathname.startsWith("/convocation/");
  if (!isLoggedIn && !isLoginPage && !isPublicShare) return { type: "redirect", to: "/login" };
  return { type: "next" };
}

export function decideParentMiddleware(pathname: string, hasParentCookie: boolean): RouteDecision {
  const isParentLogin = pathname.startsWith("/parent/login");
  if (!hasParentCookie && !isParentLogin) return { type: "redirect", to: "/parent/login" };
  return { type: "next" };
}

/** Only a real, DB-confirmed session (getAuthedUser()) may bounce /login away — never edge-only JWT presence. */
export function decideLoginPageRedirect(isAuthedRealUser: boolean): string | null {
  return isAuthedRealUser ? "/" : null;
}

/** Forced first-login password change — never applied at the shared /parent layout, or /parent/changer-mot-de-passe would redirect to itself. */
export function decidePasswordChangeRedirect(mustChangePassword: boolean): string | null {
  return mustChangePassword ? "/parent/changer-mot-de-passe" : null;
}

/**
 * Forced first-login onboarding for staff — shows a new account its real
 * responsibilities (StaffAccess grants) before it reaches any real screen.
 * Existing accounts are backfilled with a non-null onboardingCompletedAt
 * at deploy time (see migration 20260825160000), so this only ever fires
 * for genuinely new accounts going forward — never applied to /onboarding
 * itself, or it would redirect to itself.
 */
export function decideOnboardingRedirect(onboardingCompletedAt: Date | null): string | null {
  return onboardingCompletedAt ? null : "/onboarding";
}
