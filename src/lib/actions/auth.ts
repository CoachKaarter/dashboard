"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { sanitizeNextPath } from "@/lib/redirect-policy";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function loginAction(formData: FormData) {
  // Carries the Coach-vs-Cockpit login page back to where it came from
  // (see redirect-policy.ts) — sanitized again here since a form field is
  // just as attacker-controlled as the query string it was read from.
  const next = sanitizeNextPath(formData.get("next") as string | null);
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: next,
    });
  } catch (e) {
    if (e instanceof AuthError) {
      redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
    }
    throw e;
  }
}
