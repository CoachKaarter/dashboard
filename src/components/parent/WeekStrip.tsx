import Link from "next/link";
import type { ParentPlanItem } from "@/lib/parent-planning";

const DAY_NAMES = ["D", "L", "M", "M", "J", "V", "S"];

function dateParam(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * "CETTE SEMAINE" — bande compacte type L M M J V S D, un point par jour
 * avec événement. Ne réaffiche jamais le détail : le tap ouvre le vrai
 * Planning à ce jour-là (spec : "ne pas reconstruire un deuxième planning
 * complet sur l'accueil").
 */
export function WeekStrip({ days, todayKey }: { days: { date: Date; items: ParentPlanItem[] }[]; todayKey: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mb-2">Cette semaine</div>
      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-2 flex justify-between">
        {days.map(({ date, items }) => {
          const key = dateParam(date);
          const isToday = key === todayKey;
          const hasCancelled = items.length > 0 && items.every((it) => it.status === "annule");
          return (
            <Link
              key={key}
              href={`/parent/planning?vue=semaine&week=${dateParam(days[0].date)}&day=${key}`}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-colors duration-150 ${isToday ? "bg-club-primary-bg" : "active:bg-[#F6F6F4]"}`}
            >
              <span className={`text-[9.5px] font-bold uppercase ${isToday ? "text-club-primary" : "text-[#9A9DA3]"}`}>{DAY_NAMES[date.getDay()]}</span>
              <span className={`text-[14px] font-bold ${isToday ? "text-club-primary" : "text-[#16181C]"}`}>{date.getDate()}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  items.length === 0 ? "bg-transparent" : hasCancelled ? "bg-[#C9CBC7]" : isToday ? "bg-club-primary" : "bg-green"
                }`}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
