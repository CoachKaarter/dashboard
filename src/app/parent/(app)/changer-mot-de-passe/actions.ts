"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/parent-session";
import { decideParentOnboardingRedirect } from "@/lib/redirect-policy";
import { redirect } from "next/navigation";

export async function changeParentPassword(formData: FormData) {
  const parent = await requireParent();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");
  if (password.length < 6) redirect("/parent/changer-mot-de-passe?error=court");
  if (password !== confirm) redirect("/parent/changer-mot-de-passe?error=diff");

  const isFirstLogin = parent.mustChangePassword;
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.parentAccount.update({
    where: { id: parent.parentAccountId },
    data: { passwordHash, mustChangePassword: false },
  });
  // Onboarding only fires once, right after the very first password change
  // (mustChangePassword true → false) — never for a later voluntary
  // password change from /parent/profil, which reuses this same action. In
  // practice every account created via activateParentAccount already has
  // mustChangePassword: false (the parent chose their password at
  // activation) — this branch only matters for an account created some
  // other way, kept correct rather than assumed dead.
  redirect(isFirstLogin ? decideParentOnboardingRedirect(parent.onboardingCompletedAt) ?? "/parent/bienvenue" : "/parent");
}
