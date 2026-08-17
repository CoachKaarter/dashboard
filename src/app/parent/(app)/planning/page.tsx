import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";
import { confirmMyConvocation } from "./actions";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

export default async function ParentPlanningPage() {
  const parent = await requireParentReady();
  const player = await prisma.player.findUniqueOrThrow({ where: { id: parent.playerId }, include: { team: true } });

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [sessions, myConvocations] = await Promise.all([
    prisma.trainingSession.findMany({
      where: {
        date: { gte: monthStart, lt: monthEnd },
        status: { not: "Annulée" },
        OR: [{ scopeTeamId: player.teamId }, { scopeTeamId: null, category: player.team.category }],
      },
      orderBy: { date: "asc" },
    }),
    // Convocation OFFICIELLE du staff pour CE joueur uniquement — jamais la
    // liste des autres convoqués. Remplace le lien /convocation/[token]
    // partagé (qui révélait tout l'effectif) pour les familles qui ont un
    // compte (§42 de la V2).
    prisma.matchConvocation.findMany({
      where: { playerId: parent.playerId, match: { date: { gte: monthStart, lt: monthEnd } } },
      include: { match: true },
    }),
  ]);
  const convocByDateKey = new Map(myConvocations.map((c) => [c.match.date.toISOString().slice(0, 10), c]));

  // Every Saturday this month is a potential match day. When no official
  // convocation exists yet for THIS child, deliberately keep it anonymous —
  // the parent only declares "disponible ce week-end", never sees the
  // internal répartition (Phase 4 spec §18/§33).
  const saturdays: Date[] = [];
  for (let d = new Date(monthStart); d < monthEnd; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 6) saturdays.push(new Date(d));
  }

  type Item = {
    date: Date;
    kind: "entrainement" | "weekend" | "convocation";
    label: string;
    sub?: string;
    convocation?: (typeof myConvocations)[number];
  };
  const items: Item[] = [
    ...sessions.map((s) => ({ date: s.date, kind: "entrainement" as const, label: "Entraînement", sub: `${s.startTime} · ${s.location}` })),
    ...saturdays.map((d) => {
      const conv = convocByDateKey.get(d.toISOString().slice(0, 10));
      if (conv) {
        return {
          date: d,
          kind: "convocation" as const,
          label: `Convoqué${conv.match.opponent ? ` — vs ${conv.match.opponent}` : ""}`,
          sub: [conv.match.time, conv.match.meetTime ? `RDV ${conv.match.meetTime}` : null, conv.match.location].filter(Boolean).join(" · "),
          convocation: conv,
        };
      }
      return { date: d, kind: "weekend" as const, label: "Week-end football" };
    }),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <div className="flex flex-col gap-4">
      <div className="text-2xl font-bold tracking-[-0.01em]">Planning</div>
      <div className="text-[13px] text-[#8A8D93] -mt-2">{MONTHS[today.getMonth()]} {today.getFullYear()}</div>

      <div className="flex flex-col gap-2.5">
        {items.map((item, i) => (
          <div key={i} className="bg-white rounded-2xl border border-[#E7E7E2] p-3.5 flex items-center gap-3 flex-wrap">
            <div className="w-12 text-center shrink-0">
              <div className="text-[10px] uppercase tracking-[0.06em] text-[#8A8D93]">{DAY_NAMES[item.date.getDay()]}</div>
              <div className="text-[19px] font-bold">{item.date.getDate()}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold">{item.label}</div>
              {item.sub && <div className="text-[12.5px] text-[#6E7178] mt-0.5">{item.sub}</div>}
            </div>
            {item.kind === "weekend" && <span className="text-[18px]">⚽</span>}
            {item.kind === "convocation" && item.convocation && (
              <div className="flex gap-1.5 w-full sm:w-auto">
                <form action={confirmMyConvocation.bind(null, item.convocation.matchId, true)} className="flex-1 sm:flex-none">
                  <button
                    type="submit"
                    className={`w-full h-8 px-2.5 rounded-md text-[11.5px] font-semibold border ${
                      item.convocation.confirmed === true ? "bg-[#EAF4EC] border-[#3F8F5B] text-[#3F8F5B]" : "bg-white border-[#E7E7E2] text-[#6E7178]"
                    }`}
                  >
                    ✓ Je viens
                  </button>
                </form>
                <form action={confirmMyConvocation.bind(null, item.convocation.matchId, false)} className="flex-1 sm:flex-none">
                  <button
                    type="submit"
                    className={`w-full h-8 px-2.5 rounded-md text-[11.5px] font-semibold border ${
                      item.convocation.confirmed === false ? "bg-[#FBEAE8] border-[#C4362C] text-[#C4362C]" : "bg-white border-[#E7E7E2] text-[#6E7178]"
                    }`}
                  >
                    ✗ Absent
                  </button>
                </form>
              </div>
            )}
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
