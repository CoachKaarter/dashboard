import { redirect } from "next/navigation";
import { getAuthedUser } from "@/lib/authz";
import { decideLoginPageRedirect, sanitizeNextPath } from "@/lib/redirect-policy";
import { StaffLoginScreen } from "@/components/StaffLoginScreen";

// Historical shared door for both the Cockpit and /coach (?next= carries
// which one) — kept working for any existing bookmark/link, but /coach now
// has its own stable door at /coach/login (src/app/coach/(public)/login).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next: rawNext } = await searchParams;
  const next = sanitizeNextPath(rawNext);
  const variant = next.startsWith("/coach") ? "coach" : "cockpit";

  // Deliberately not done in src/proxy.ts: middleware only knows the JWT
  // decodes, never that the account is still active in the DB (that check
  // — and the resulting redirect loop it caused when done at the edge —
  // belongs here, where getAuthedUser() re-reads the User row).
  const user = await getAuthedUser();
  const target = decideLoginPageRedirect(!!user, next);
  if (target) redirect(target);

  return <StaffLoginScreen variant={variant} next={next} error={error} />;
}
