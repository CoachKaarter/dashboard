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
  // /coach/login is a stable, bookmarkable door onto the coach's own
  // account (src/app/coach/(public)/login) — never requires going through
  // /coach first. /login (optionally with ?next=/coach...) is kept working
  // for old bookmarks/links, both share the same staff session.
  const isLoginPage = pathname.startsWith("/login") || pathname.startsWith("/coach/login");
  // Convocation share links are handed to players/parents who have no
  // account — deliberately public, gated only by the unguessable token.
  const isPublicShare = pathname.startsWith("/convocation/");
  if (!isLoggedIn && !isLoginPage && !isPublicShare) {
    const to = pathname.startsWith("/coach") ? `/coach/login?next=${encodeURIComponent(pathname)}` : "/login";
    return { type: "redirect", to };
  }
  return { type: "next" };
}

export function decideParentMiddleware(pathname: string, hasParentCookie: boolean): RouteDecision {
  // Activation (invitation link) and password reset must be reachable by a
  // parent who has never logged in — that's the whole point of both flows —
  // so, like /parent/login, they're public regardless of the session cookie.
  const isPublic =
    pathname.startsWith("/parent/login") ||
    pathname.startsWith("/parent/activation") ||
    pathname.startsWith("/parent/reinitialiser") ||
    pathname.startsWith("/parent/mot-de-passe-oublie");
  if (!hasParentCookie && !isPublic) return { type: "redirect", to: "/parent/login" };
  return { type: "next" };
}

/**
 * Never trust ?next= as-is — it's attacker-controlled query input reaching
 * a redirect. Only a same-origin relative path survives; anything else
 * (absolute URL, protocol-relative "//host", missing leading slash) falls
 * back to "/" rather than sending the browser somewhere else entirely.
 */
export function sanitizeNextPath(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("://")) return "/";
  return path;
}

/** Only a real, DB-confirmed session (getAuthedUser()) may bounce /login away — never edge-only JWT presence. */
export function decideLoginPageRedirect(isAuthedRealUser: boolean, next?: string | null): string | null {
  return isAuthedRealUser ? sanitizeNextPath(next) : null;
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
