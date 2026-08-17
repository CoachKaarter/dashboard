import Link from "next/link";
import { requireParent } from "@/lib/parent-session";

const NAV = [
  { href: "/parent", label: "Accueil", icon: "🏠" },
  { href: "/parent/planning", label: "Planning", icon: "📅" },
  { href: "/parent/profil", label: "Mon enfant", icon: "👤" },
];

export default async function ParentAppLayout({ children }: { children: React.ReactNode }) {
  // Only "is there a valid session" here — the forced first-login password
  // change (requireParentReady, in each of the 3 tab pages individually)
  // must NOT run at this shared layout level, or /parent/changer-mot-de-passe
  // would redirect to itself forever.
  await requireParent();

  return (
    <div className="min-h-screen bg-[#F6F6F3] flex flex-col">
      <main className="flex-1 max-w-[480px] w-full mx-auto px-4 pt-5 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E7E7E2] pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-[480px] mx-auto flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[#8A8D93] active:opacity-60"
            >
              <span className="text-[20px] leading-none">{item.icon}</span>
              <span className="text-[10.5px] font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
