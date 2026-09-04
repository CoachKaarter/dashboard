"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ClubIdentity } from "@/lib/club";
import { ChildSwitcher, type SwitcherChild } from "./ChildSwitcher";

const NAV = [
  { href: "/parent", label: "Accueil" },
  { href: "/parent/planning", label: "Planning" },
  { href: "/parent/matchs", label: "Matchs" },
  { href: "/parent/infos", label: "Infos" },
  { href: "/parent/suivi", label: "Suivi" },
  { href: "/parent/profil", label: "Profil" },
];

// Desktop-only counterpart to ParentBottomNav — same 6 destinations, same
// active-route logic, shown side-by-side with the club identity instead of
// stacked at the bottom of a narrow viewport.
export function ParentTopNav({
  category,
  club,
  familyChildren,
  activePlayerId,
}: {
  category: string;
  club: ClubIdentity;
  familyChildren: SwitcherChild[];
  activePlayerId: string;
}) {
  const pathname = usePathname();

  return (
    <header className="hidden md:block bg-sidebar text-sidebar-text">
      <div className="max-w-[880px] mx-auto flex items-center justify-between px-6 h-16">
        <div className="flex items-center gap-3">
          {club.hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/club/logo?v=${club.logoVersion}`} alt="" className="w-8 h-8 rounded-lg object-contain shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-club-primary shrink-0" />
          )}
          <div>
            <div className="text-white text-[14px] font-bold tracking-[0.01em]">{club.name}</div>
            <div className="text-[11.5px] text-sidebar-text">Catégorie {category} — Espace parents</div>
          </div>
          <ChildSwitcher familyChildren={familyChildren} activePlayerId={activePlayerId} variant="dark" />
        </div>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = item.href === "/parent" ? pathname === "/parent" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 h-9 rounded-full flex items-center text-[13.5px] font-semibold transition-colors duration-150 ${
                  active ? "bg-club-primary text-club-primary-foreground" : "text-sidebar-text hover:text-sidebar-text-hover"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
