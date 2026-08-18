import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Cookie name must match src/parent-auth.ts's cookies.sessionToken.name —
// this is only a fast redirect on cookie *presence*, not real verification.
// The actual check (account still active, session still decodes, playerId
// still valid) happens server-side on every /parent/* request via
// requireParent() in src/lib/parent-session.ts — never trust middleware
// alone for an area handling minors' data.
//
// Presence of this cookie must NEVER be read as "the parent is logged in" —
// a stale/expired/corrupted cookie is still "present". Redirecting away from
// /parent/login just because the cookie exists caused an infinite loop for
// exactly that case: requireParent() finds the session invalid and sends the
// browser to /parent/login, middleware sees the (stale) cookie and bounces
// it straight back to /parent, forever — Safari surfaces this as "too many
// redirects". /parent/login must always be reachable; the real validation
// (and, on success, a fresh cookie that overwrites any stale one) happens
// server-side via requireParent()/getAuthedParent() and parentSignIn().
const PARENT_COOKIE = "parent-session-token";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/parent")) {
    const isParentLogin = pathname.startsWith("/parent/login");
    const hasParentCookie = req.cookies.has(PARENT_COOKIE);
    if (!hasParentCookie && !isParentLogin) {
      return NextResponse.redirect(new URL("/parent/login", req.nextUrl));
    }
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth;
  const isLoginPage = pathname.startsWith("/login");
  // Convocation share links are handed to players/parents who have no
  // account — deliberately public, gated only by the unguessable token.
  const isPublicShare = pathname.startsWith("/convocation/");

  if (!isLoggedIn && !isLoginPage && !isPublicShare) {
    const loginUrl = new URL("/login", req.nextUrl);
    return NextResponse.redirect(loginUrl);
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
