import { requireParent } from "@/lib/parent-session";
import { getClub } from "@/lib/club";
import { ParentBottomNav } from "@/components/parent/ParentBottomNav";
import { ParentTopNav } from "@/components/parent/ParentTopNav";
import { ParentHeaderBar } from "@/components/parent/ParentHeaderBar";

export default async function ParentAppLayout({ children }: { children: React.ReactNode }) {
  // Only "is there a valid session" here — the forced first-login password
  // change (requireParentReady, in each of the 3 tab pages individually)
  // must NOT run at this shared layout level, or /parent/changer-mot-de-passe
  // would redirect to itself forever.
  const [parent, club] = await Promise.all([requireParent(), getClub()]);

  return (
    // Barlow / Barlow Condensed scoped to the Parent shell only (visual
    // identity from the Claude Design "Espace Parent v2" mockup) — Cockpit
    // and Coach keep the default Archivo body font untouched.
    <div className="min-h-screen bg-[#F6F6F4] flex flex-col" style={{ fontFamily: "var(--font-parent-body)" }}>
      <ParentHeaderBar category={parent.player.teamCategory} club={club} />
      <ParentTopNav category={parent.player.teamCategory} club={club} />
      <main className="flex-1 max-w-[560px] md:max-w-[720px] w-full mx-auto px-4 md:px-6 pt-5 pb-28 md:pb-12">{children}</main>
      <ParentBottomNav />
    </div>
  );
}
