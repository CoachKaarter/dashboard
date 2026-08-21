"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HouseIcon, CalendarIcon, TargetIcon, UserIcon, FlagIcon, MegaphoneIcon } from "./icons";

const NAV = [
  { href: "/parent", label: "Accueil", Icon: HouseIcon },
  { href: "/parent/planning", label: "Planning", Icon: CalendarIcon },
  { href: "/parent/matchs", label: "Matchs", Icon: FlagIcon },
  { href: "/parent/infos", label: "Infos", Icon: MegaphoneIcon },
  { href: "/parent/suivi", label: "Suivi", Icon: TargetIcon },
  { href: "/parent/profil", label: "Profil", Icon: UserIcon },
];

export function ParentBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E7E7E2] pb-[env(safe-area-inset-bottom)] z-20">
      <div className="max-w-[560px] mx-auto flex">
        {NAV.map((item) => {
          const active = item.href === "/parent" ? pathname === "/parent" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 min-h-[56px] justify-center active:opacity-70 active:scale-[0.96] transition-transform duration-100"
            >
              <span
                className={`w-8 h-6 rounded-full flex items-center justify-center transition-all duration-150 ${
                  active ? "bg-green-bg text-green scale-105" : "text-[#9A9DA3] scale-100"
                }`}
              >
                <item.Icon size={17} />
              </span>
              <span className={`text-[9.5px] font-semibold transition-colors duration-150 ${active ? "text-green" : "text-[#9A9DA3]"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
