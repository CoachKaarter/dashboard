"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HouseIcon, CalendarIcon, TargetIcon, UserIcon } from "./icons";

const NAV = [
  { href: "/parent", label: "Accueil", Icon: HouseIcon },
  { href: "/parent/planning", label: "Planning", Icon: CalendarIcon },
  { href: "/parent/suivi", label: "Suivi", Icon: TargetIcon },
  { href: "/parent/profil", label: "Profil", Icon: UserIcon },
];

export function ParentBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E7E7E2] pb-[env(safe-area-inset-bottom)] z-20">
      <div className="max-w-[560px] mx-auto flex">
        {NAV.map((item) => {
          const active = item.href === "/parent" ? pathname === "/parent" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 min-h-[56px] justify-center active:opacity-70"
            >
              <span
                className={`w-9 h-7 rounded-full flex items-center justify-center transition-colors ${
                  active ? "bg-green-bg text-green" : "text-[#9A9DA3]"
                }`}
              >
                <item.Icon size={20} />
              </span>
              <span className={`text-[10.5px] font-semibold ${active ? "text-green" : "text-[#9A9DA3]"}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
