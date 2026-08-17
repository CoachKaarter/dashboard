import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

export default async function ParentPlanningPage() {
  const parent = await requireParentReady();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: parent.playerId }, include: { team: true } });

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const sessions = await prisma.trainingSession.findMany({
    where: {
      date: { gte: monthStart, lt: monthEnd },
      status: { not: "Annulée" },
      OR: [{ scopeTeamId: player.teamId }, { scopeTeamId: null, category: player.team.category }],
    },
    orderBy: { date: "asc" },
  });

  // Every Saturday this month is a potential match day. Deliberately not
  // revealing which team, opponent, or whether a real convocation exists —
  // the parent only ever declares "disponible ce week-end", never sees the
  // internal répartition (Phase 4 spec §18/§33).
  const saturdays: Date[] = [];
  for (let d = new Date(monthStart); d < monthEnd; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 6) saturdays.push(new Date(d));
  }

  type Item = { date: Date; kind: "entrainement" | "weekend"; label: string; sub?: string };
  const items: Item[] = [
    ...sessions.map((s) => ({ date: s.date, kind: "entrainement" as const, label: "Entraînement", sub: `${s.startTime} · ${s.location}` })),
    ...saturdays.map((d) => ({ date: d, kind: "weekend" as const, label: "Week-end football" })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="flex flex-col gap-4">
      <div className="text-2xl font-bold tracking-[-0.01em]">Planning</div>
      <div className="text-[13px] text-[#8A8D93] -mt-2">{MONTHS[today.getMonth()]} {today.getFullYear()}</div>

      <div className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#E7E7E2] p-3.5 flex items-center gap-3">
            <div className="w-12 text-center shrink-0">
              <div className="text-[10px] uppercase tracking-[0.06em] text-[#8A8D93]">{DAY_NAMES[item.date.getDay()]}</div>
              <div className="text-[19px] font-bold">{item.date.getDate()}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold">{item.label}</div>
              {item.sub && <div className="text-[12.5px] text-[#6E7178] mt-0.5">{item.sub}</div>}
            </div>
            {item.kind === "weekend" && <span className="text-[18px]">⚽</span>}
          </div>
        ))}
        {items.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E7E7E2] p-6 text-center text-[13px] text-[#8A8D93]">
            Rien de prévu ce mois-ci.
          </div>
        )}
      </div>
    </div>
  );
}
