import { redirect } from "next/navigation";
import { requireParent, type AuthedParent } from "@/lib/parent-session";

/** Same as requireParent(), plus forces the first-login password change before any other page renders. */
export async function requireParentReady(): Promise<AuthedParent> {
  const parent = await requireParent();
  if (parent.mustChangePassword) redirect("/parent/changer-mot-de-passe");
  return parent;
}
