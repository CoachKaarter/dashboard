"use server";

import { signIn, signOut } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { sanitizeNextPath } from "@/lib/redirect-policy";

// Defaults to the Cockpit's door; the coach profile page binds "/coach/login"
// so signing out there lands back on the coach's own bookmarkable door,
// not the Cockpit's — same shared session either way.
export async function signOutAction(redirectTo: string = "/login") {
  await signOut({ redirectTo });
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
      // Send the failure back to whichever door it came from (/coach/login
      // vs /login) — not always the Cockpit's, or a coach retrying after a
      // typo would silently lose their bookmarked coach URL.
      const loginPath = next.startsWith("/coach") ? "/coach/login" : "/login";
      redirect(`${loginPath}?error=1&next=${encodeURIComponent(next)}`);
    }
    throw e;
  }
}
