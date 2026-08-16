import Link from "next/link";
import { ReactNode } from "react";

export function FilterChip({
  href,
  active,
  children,
  mono = false,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center h-7 px-[11px] rounded-md text-xs font-semibold border transition-colors ${
        mono ? "font-mono" : ""
      } ${
        active
          ? "bg-ink text-white border-ink"
          : "bg-surface text-ink-soft border-line hover:border-ink/40"
      }`}
    >
      {children}
    </Link>
  );
}
