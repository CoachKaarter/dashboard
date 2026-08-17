import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  // Convocation share links are handed to players/parents who have no
  // account — deliberately public, gated only by the unguessable token.
  const isPublicShare = req.nextUrl.pathname.startsWith("/convocation/");

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
