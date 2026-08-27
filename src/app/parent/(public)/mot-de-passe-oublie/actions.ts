"use server";

import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/parent-password-reset";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function requestResetAction(formData: FormData) {
  const identifier = String(formData.get("identifier") || "");

  const ip = await getClientIp();
  // Une seule clé pour IP + identifiant évite qu'un visiteur legitime tapant
  // plusieurs identifiants d'affilée se bloque lui-même trop vite, tout en
  // limitant un script qui arroserait une liste d'adresses depuis une IP.
  const { allowed } = await checkRateLimit(`forgot-password:${ip}`, { max: 10, windowMs: 15 * 60 * 1000 });

  // §31/§35 : toujours la même réponse générique, que le compte existe ou
  // non, que la limite soit atteinte ou non — jamais de signal permettant
  // de deviner si un identifiant correspond à un compte réel.
  if (allowed) {
    await requestPasswordReset(identifier);
  }

  redirect("/parent/mot-de-passe-oublie?sent=1");
}
