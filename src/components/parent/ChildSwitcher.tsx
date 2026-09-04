"use client";

import { usePathname } from "next/navigation";
import { setActiveChildAction } from "@/app/parent/(app)/actions";

export type SwitcherChild = { id: string; firstName: string; lastName: string };

// Rendu uniquement quand il y a plus d'un enfant — la grande majorité des
// familles n'en verront jamais la trace. Un <select> natif qui se soumet
// lui-même au changement plutôt qu'un vrai bouton : pas de JS de plus que
// nécessaire, fonctionne même si l'hydratation n'a pas encore eu lieu.
export function ChildSwitcher({
  familyChildren,
  activePlayerId,
  variant = "dark",
}: {
  familyChildren: SwitcherChild[];
  activePlayerId: string;
  variant?: "dark" | "light";
}) {
  const pathname = usePathname();
  if (familyChildren.length <= 1) return null;

  const isDark = variant === "dark";

  return (
    <form action={setActiveChildAction} className="shrink-0">
      <input type="hidden" name="redirectTo" value={pathname} />
      <select
        name="playerId"
        defaultValue={activePlayerId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        aria-label="Changer d'enfant"
        className={`h-8 rounded-full pl-3 pr-7 text-[12.5px] font-semibold outline-none cursor-pointer appearance-none bg-[length:14px] bg-[right_0.5rem_center] bg-no-repeat ${
          isDark ? "bg-white/10 text-white" : "bg-[#F0F0EC] text-[#16181c]"
        }`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='${
            isDark ? "white" : "%2316181c"
          }'%3E%3Cpath fill-rule='evenodd' d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z' clip-rule='evenodd'/%3E%3C/svg%3E")`,
        }}
      >
        {familyChildren.map((c) => (
          <option key={c.id} value={c.id} className="text-[#16181c]">
            {c.firstName}
          </option>
        ))}
      </select>
    </form>
  );
}
