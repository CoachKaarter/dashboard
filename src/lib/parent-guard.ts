import { redirect } from "next/navigation";
import { requireParent, type AuthedParent } from "@/lib/parent-session";
import { decidePasswordChangeRedirect, decideParentOnboardingRedirect } from "@/lib/redirect-policy";

/**
 * Same as requireParent(), plus forces the first-login password change and
 * the mandatory informations form before any other page renders. Order
 * matters: password first (so the account is genuinely secured), then the
 * onboarding info form.
 */
export async function requireParentReady(): Promise<AuthedParent> {
  const parent = await requireParent();
  const pwTarget = decidePasswordChangeRedirect(parent.mustChangePassword);
  if (pwTarget) redirect(pwTarget);
  const infoTarget = decideParentOnboardingRedirect(parent.onboardingCompletedAt);
  if (infoTarget) redirect(infoTarget);
  return parent;
}
