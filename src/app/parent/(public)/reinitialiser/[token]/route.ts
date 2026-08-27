import { NextRequest, NextResponse } from "next/server";

// Même discipline que /parent/activation/[token] : le jeton brut ne reste
// dans l'URL que pour cette seule requête, transféré aussitôt dans un
// cookie HttpOnly de courte durée avant de rediriger vers l'URL propre.
const COOKIE_NAME = "parent-reset";
const COOKIE_TTL_SECONDS = 15 * 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const res = NextResponse.redirect(new URL("/parent/reinitialiser", req.nextUrl));
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/parent/reinitialiser",
    maxAge: COOKIE_TTL_SECONDS,
  });
  return res;
}
