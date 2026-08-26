import Link from "next/link";
import { ParentCard } from "./ParentCard";
import { PARENT_PLAN_STATUS_STYLE } from "@/lib/parent-plan-status";
import type { ParentPlanItem } from "@/lib/parent-planning";

const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/**
 * "À VENIR" — 2-3 événements maximum, jamais toute la saison (spec : le
 * Planning existe pour ça). Bordure colorée + pastille de statut : même
 * langage visuel que /parent/planning (src/lib/parent-plan-status.ts),
 * repris de la maquette Claude Design "Espace Parent v2".
 */
export function UpcomingList({ items }: { items: ParentPlanItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between mt-1">
        <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3]">À venir</div>
        <Link href="/parent/planning" className="text-[12.5px] font-bold text-parent-navy">
          Tout le planning →
        </Link>
      </div>
      {items.map((it, i) => {
        const s = PARENT_PLAN_STATUS_STYLE[it.status];
        return (
          <Link key={i} href="/parent/planning">
            <ParentCard className="flex items-center gap-3" style={{ borderLeftWidth: 4, borderLeftColor: s.borderColor }}>
              <div className="w-11 text-center shrink-0">
                <div className="text-[9.5px] uppercase tracking-[0.05em] text-[#8A8D93]">{DAY_NAMES[it.date.getDay()]}</div>
                <div className="text-[17px] font-bold" style={{ fontFamily: "var(--font-parent-display)" }}>
                  {it.date.getDate()}
                </div>
                <div className="text-[9px] text-[#8A8D93]">{MONTHS[it.date.getMonth()]}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[13.5px] font-bold ${it.status === "annule" ? "line-through text-[#9A9DA3]" : ""}`}>{it.label}</div>
                {it.sub && <div className="text-[12px] text-[#6E7178] mt-0.5">{it.sub}</div>}
              </div>
              {s.label && <span className={`shrink-0 text-[10px] font-bold tracking-[0.05em] px-2 h-[19px] rounded-full flex items-center ${s.chip}`}>{s.label}</span>}
            </ParentCard>
          </Link>
        );
      })}
    </div>
  );
}
