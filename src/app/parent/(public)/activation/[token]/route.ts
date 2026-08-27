import { NextRequest, NextResponse } from "next/server";

// §7 du cahier des charges : ce lien porte le jeton brut une seule fois,
// dans l'URL que le parent a cliquée depuis son email. On le transfère
// aussitôt dans un cookie HttpOnly de très courte durée puis on redirige
// vers l'URL propre /parent/activation (sans jeton) — le jeton ne réapparaît
// plus jamais dans une barre d'adresse, un historique de navigateur, un
// Referer sortant, ou un log d'accès après cette seule requête. La validité
// réelle (existe / pas utilisé / pas révoqué / pas expiré) est vérifiée par
// la page elle-même à partir du cookie, jamais ici — cette route ne fait
// que transporter le jeton, jamais de décision métier.
const COOKIE_NAME = "parent-activation";
const COOKIE_TTL_SECONDS = 15 * 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const res = NextResponse.redirect(new URL("/parent/activation", req.nextUrl));
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/parent/activation",
    maxAge: COOKIE_TTL_SECONDS,
  });
  return res;
}
