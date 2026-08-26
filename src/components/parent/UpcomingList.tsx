import Link from "next/link";
import { ParentCard } from "./ParentCard";
import type { ParentPlanItem } from "@/lib/parent-planning";

const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/**
 * "À VENIR" — 2-3 événements maximum, jamais toute la saison (spec : le
 * Planning existe pour ça). Volontairement minimal : pas de bouton d'action
 * ici, juste de quoi se repérer — les actions vivent dans le Hero.
 */
export function UpcomingList({ items }: { items: ParentPlanItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-1">À venir</div>
      {items.map((it, i) => (
        <Link key={i} href="/parent/planning">
          <ParentCard className="flex items-center gap-3">
            <div className="w-11 text-center shrink-0">
              <div className="text-[9.5px] uppercase tracking-[0.05em] text-[#8A8D93]">{DAY_NAMES[it.date.getDay()]}</div>
              <div className="text-[17px] font-bold">{it.date.getDate()}</div>
              <div className="text-[9px] text-[#8A8D93]">{MONTHS[it.date.getMonth()]}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-bold">{it.label}</div>
              {it.sub && <div className="text-[12px] text-[#6E7178] mt-0.5">{it.sub}</div>}
            </div>
          </ParentCard>
        </Link>
      ))}
    </div>
  );
}
