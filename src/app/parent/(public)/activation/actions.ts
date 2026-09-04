"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { parentSignIn } from "@/parent-auth";
import { activateParentAccount, linkPlayerToExistingAccount } from "@/lib/parent-activation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const COOKIE_NAME = "parent-activation";

export async function activateAction(formData: FormData) {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) redirect("/parent/activation");

  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 10) redirect("/parent/activation?error=court");
  if (password !== confirm) redirect("/parent/activation?error=diff");

  // §33-36 : compatible serverless (compteur Postgres), protège contre un
  // script qui tenterait d'activer en boucle — un jeton à 256 bits reste de
  // toute façon impossible à deviner, ceci ne fait que ralentir l'abus.
  const ip = await getClientIp();
  const { allowed } = await checkRateLimit(`activation:${ip}`, { max: 20, windowMs: 15 * 60 * 1000 });
  if (!allowed) redirect("/parent/activation?error=invalid");

  const result = await activateParentAccount(token, password);
  if (!result.ok) redirect("/parent/activation");

  store.delete(COOKIE_NAME);

  // Course rare : l'écran affiché supposait "création" mais un compte
  // existant a été détecté pendant la transaction (voir
  // activateParentAccount) — le mot de passe saisi n'a servi à rien, on ne
  // peut pas connecter automatiquement avec, direction connexion normale.
  if (result.mode === "linked") redirect("/parent/login?linked=1");

  // Connexion automatique via le mécanisme officiel Parent Auth (§36) —
  // jamais un cookie bricolé à la main. Le mot de passe en clair n'existe
  // que dans cette requête, jamais persisté ni journalisé.
  try {
    await parentSignIn("credentials", { username: result.username, password, redirectTo: "/parent/informations" });
  } catch (e) {
    if (e instanceof AuthError) redirect("/parent/login");
    throw e;
  }
}

/** Branche "rejoindre un compte famille existant" — pas de mot de passe : la possession du jeton d'invitation suffit, voir linkPlayerToExistingAccount. */
export async function confirmLinkAction() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) redirect("/parent/activation");

  const ip = await getClientIp();
  const { allowed } = await checkRateLimit(`activation:${ip}`, { max: 20, windowMs: 15 * 60 * 1000 });
  if (!allowed) redirect("/parent/activation?error=invalid");

  const result = await linkPlayerToExistingAccount(token);
  if (!result.ok) redirect("/parent/activation");

  store.delete(COOKIE_NAME);
  redirect("/parent/login?linked=1");
}
