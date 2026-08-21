import { redirect } from "next/navigation";
import { requireParent, type AuthedParent } from "@/lib/parent-session";
import { decidePasswordChangeRedirect } from "@/lib/redirect-policy";

/** Same as requireParent(), plus forces the first-login password change before any other page renders. */
export async function requireParentReady(): Promise<AuthedParent> {
  const parent = await requireParent();
  const target = decidePasswordChangeRedirect(parent.mustChangePassword);
  if (target) redirect(target);
  return parent;
}
