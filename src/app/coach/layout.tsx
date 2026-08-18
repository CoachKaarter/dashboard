import { requireUser } from "@/lib/authz";
import { CoachBottomNav } from "@/components/coach/CoachBottomNav";

// Same staff auth as the desktop Cockpit — /coach is not a new account
// system, just a distinct mobile-first shell (no Sidebar) for the same
// User. Middleware already gates unauthenticated access; requireUser()
// here re-verifies on every request (active flag, current teamIds), same
// as every (app) route.
export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="min-h-screen bg-[#F6F6F4] flex flex-col">
      <main className="flex-1 max-w-[560px] w-full mx-auto px-4 pt-6 pb-28">{children}</main>
      <CoachBottomNav />
    </div>
  );
}
