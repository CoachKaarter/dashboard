import { requireParent } from "@/lib/parent-session";
import { ParentBottomNav } from "@/components/parent/ParentBottomNav";

export default async function ParentAppLayout({ children }: { children: React.ReactNode }) {
  // Only "is there a valid session" here — the forced first-login password
  // change (requireParentReady, in each of the 3 tab pages individually)
  // must NOT run at this shared layout level, or /parent/changer-mot-de-passe
  // would redirect to itself forever.
  await requireParent();

  return (
    <div className="min-h-screen bg-[#F6F6F4] flex flex-col">
      <main className="flex-1 max-w-[560px] w-full mx-auto px-4 pt-6 pb-28">{children}</main>
      <ParentBottomNav />
    </div>
  );
}
