"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

export function NavLink({
  href,
  label,
  badge,
  badgeUrgent,
}: {
  href: string;
  label: string;
  badge?: ReactNode;
  badgeUrgent?: boolean;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 w-full h-[31px] px-2.5 mb-px rounded-md text-[12.5px] transition-colors duration-150 ${
        active ? "bg-sidebar-active text-white font-semibold" : "text-sidebar-text font-medium hover:bg-sidebar-active/60 hover:text-sidebar-text-hover"
      }`}
    >
      <span
        className={`w-1 h-1 rounded-full shrink-0 transition-all duration-150 ${active ? "bg-club-primary scale-125" : "bg-white/15 scale-100"}`}
      />
      <span className="flex-1 text-left truncate">{label}</span>
      {badge !== undefined && badge !== "" && (
        <span className={`font-mono text-[10px] ${badgeUrgent ? "text-[#e86a5e]" : "text-muted"}`}>{badge}</span>
      )}
    </Link>
  );
}
