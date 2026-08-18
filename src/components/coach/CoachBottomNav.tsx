"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HouseIcon, CalendarIcon, FlagIcon, MoreIcon } from "./icons";

const NAV = [
  { href: "/coach", label: "Aujourd'hui", Icon: HouseIcon },
  { href: "/coach/seances", label: "Séances", Icon: CalendarIcon },
  { href: "/coach/matchs", label: "Matchs", Icon: FlagIcon },
  { href: "/coach/profil", label: "Plus", Icon: MoreIcon },
];

export function CoachBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E7E7E2] pb-[env(safe-area-inset-bottom)] z-20">
      <div className="max-w-[560px] mx-auto flex">
        {NAV.map((item) => {
          const active = item.href === "/coach" ? pathname === "/coach" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 min-h-[56px] justify-center active:opacity-70 active:scale-[0.96] transition-transform duration-100"
            >
              <span
                className={`w-9 h-7 rounded-full flex items-center justify-center transition-all duration-150 ${
                  active ? "bg-green-bg text-green scale-105" : "text-[#9A9DA3] scale-100"
                }`}
              >
                <item.Icon size={20} />
              </span>
              <span className={`text-[10.5px] font-semibold transition-colors duration-150 ${active ? "text-green" : "text-[#9A9DA3]"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
