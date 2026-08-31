import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/authz";
import { decideLoginPageRedirect, sanitizeNextPath } from "@/lib/redirect-policy";
import { StaffLoginScreen } from "@/components/StaffLoginScreen";

// Stable, bookmarkable door onto the coach's own account — no longer
// requires going through /coach first to get bounced here with a ?next=.
// Same shared staff account/session as the Cockpit (src/app/login) — this
// is only a distinct entry URL, never a second auth system. Lives outside
// src/app/coach/(app) (which requireUser()s in its layout) specifically so
// this page stays reachable while logged out — see that layout's comment
// and the /parent/(public) vs /parent/(app) split it mirrors.
export default async function CoachLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: rawNext } = await searchParams;
  const next = rawNext ? sanitizeNextPath(rawNext) : "/coach";

  const user = await getAuthedUser();
  const target = decideLoginPageRedirect(!!user, next);
  if (target) redirect(target);

  return <StaffLoginScreen variant="coach" next={next} error={error} />;
}
