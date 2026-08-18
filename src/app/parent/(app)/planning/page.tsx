import Link from "next/link";
import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/availability";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon, XIcon } from "@/components/parent/icons";
import { confirmMyConvocation } from "./actions";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

function mondayOf(d: Date) {
  const r = new Date(d);
  const diff = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - diff);
  return r;
}
function monthParam(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ParentPlanningPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const parent = await requireParentReady();
  const { month } = await searchParams;
  const player = await prisma.player.findUniqueOrThrow({ where: { id: parent.playerId }, include: { team: true } });

  const today = new Date();
  const viewedMonth = month && /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01`) : new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStart = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth(), 1);
  const monthEnd = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 1);
  const prevMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() - 1, 1);
  const nextMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() + 1, 1);

  const [sessions, myConvocations, myAvailability] = await Promise.all([
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
    prisma.playerAvailability.findMany({
      where: { playerId: parent.playerId, eventDate: { gte: monthStart, lt: monthEnd } },
    }),
  ]);
  const convocByDateKey = new Map(myConvocations.map((c) => [c.match.date.toISOString().slice(0, 10), c]));
  const availByDateKey = new Map(myAvailability.filter((a) => a.type === "WEEKEND").map((a) => [a.eventDate.toISOString().slice(0, 10), a]));
  const availBySession = new Map(myAvailability.filter((a) => a.sessionId).map((a) => [a.sessionId as string, a]));

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
    answer?: string;
  };
  const items: Item[] = [
    ...sessions.map((s) => ({
      date: s.date,
      kind: "entrainement" as const,
      label: "Entraînement",
      sub: `${s.startTime} · ${s.location}`,
      answer: availBySession.get(s.id)?.status,
    })),
    ...saturdays.map((d) => {
      const conv = convocByDateKey.get(d.toISOString().slice(0, 10));
      if (conv) {
        return {
          date: d,
          kind: "convocation" as const,
          label: `Match${conv.match.opponent ? ` — ${conv.match.opponent}` : ""}`,
          sub: [conv.match.time ? `Coup d'envoi ${conv.match.time}` : null, conv.match.meetTime ? `RDV ${conv.match.meetTime}` : null, conv.match.location]
            .filter(Boolean)
            .join(" · "),
          convocation: conv,
        };
      }
      return { date: d, kind: "weekend" as const, label: "Disponibilité du samedi", answer: availByDateKey.get(d.toISOString().slice(0, 10))?.status };
    }),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const thisWeekMonday = mondayOf(getWeekStart(today));
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = mondayOf(item.date).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  const groupKeys = [...groups.keys()].sort();

  function groupLabel(mondayIso: string) {
    const monday = new Date(mondayIso);
    if (monday.getTime() === thisWeekMonday.getTime()) return "Cette semaine";
    if (monday.getTime() === thisWeekMonday.getTime() + 7 * 86400000) return "Semaine prochaine";
    return `Semaine du ${monday.getDate()} ${MONTHS[monday.getMonth()].toLowerCase()}`;
  }

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader title="Planning" />

      <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E7E7E2] px-2 py-1.5">
        <Link href={`/parent/planning?month=${monthParam(prevMonth)}`} className="w-10 h-10 rounded-xl flex items-center justify-center text-[#6E7178] active:bg-[#F6F6F4] active:scale-90 transition-all duration-100" aria-label="Mois précédent">
          <ChevronLeftIcon size={19} />
        </Link>
        <div className="text-[14.5px] font-bold">
          {MONTHS[viewedMonth.getMonth()]} {viewedMonth.getFullYear()}
        </div>
        <Link href={`/parent/planning?month=${monthParam(nextMonth)}`} className="w-10 h-10 rounded-xl flex items-center justify-center text-[#6E7178] active:bg-[#F6F6F4] active:scale-90 transition-all duration-100" aria-label="Mois suivant">
          <ChevronRightIcon size={19} />
        </Link>
      </div>

      {groupKeys.length === 0 && (
        <ParentCard className="text-center py-8">
          <div className="text-[14px] text-[#6E7178]">Rien de prévu ce mois-ci.</div>
        </ParentCard>
      )}

      {groupKeys.map((key) => (
        <div key={key} className="flex flex-col gap-2.5">
          <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-1">{groupLabel(key)}</div>
          {groups.get(key)!.map((item, i) => (
            <ParentCard key={i} className="flex items-center gap-3 flex-wrap">
              <div className="w-12 text-center shrink-0">
                <div className="text-[10px] uppercase tracking-[0.06em] text-[#8A8D93]">{DAY_NAMES[item.date.getDay()]}</div>
                <div className="text-[19px] font-bold">{item.date.getDate()}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] font-bold">{item.label}</div>
                {item.sub && <div className="text-[12.5px] text-[#6E7178] mt-0.5">{item.sub}</div>}
                {item.kind !== "convocation" && item.answer && (
                  <div className={`text-[12px] font-semibold mt-1 ${item.answer === "AVAILABLE" ? "text-green" : "text-red"}`}>
                    {item.answer === "AVAILABLE" ? "✓ " : "✕ "}
                    {item.kind === "weekend" ? (item.answer === "AVAILABLE" ? "Disponible" : "Indisponible") : item.answer === "AVAILABLE" ? "Présent" : "Absent"}
                  </div>
                )}
              </div>
              {item.kind === "weekend" && !item.answer && <span className="text-[18px]" aria-hidden>⚽</span>}
              {item.kind === "convocation" && item.convocation && (
                <div className="flex gap-1.5 w-full sm:w-auto">
                  <form action={confirmMyConvocation.bind(null, item.convocation.matchId, true)} className="flex-1 sm:flex-none">
                    <button
                      type="submit"
                      className={`w-full h-9 px-3 rounded-lg text-[12px] font-bold border-2 inline-flex items-center justify-center gap-1 active:scale-95 transition-all duration-150 ${
                        item.convocation.confirmed === true ? "bg-green border-green text-white" : "bg-white border-[#E7E7E2] text-green"
                      }`}
                    >
                      <CheckIcon size={14} /> Je viens
                    </button>
                  </form>
                  <form action={confirmMyConvocation.bind(null, item.convocation.matchId, false)} className="flex-1 sm:flex-none">
                    <button
                      type="submit"
                      className={`w-full h-9 px-3 rounded-lg text-[12px] font-bold border-2 inline-flex items-center justify-center gap-1 active:scale-95 transition-all duration-150 ${
                        item.convocation.confirmed === false ? "bg-red border-red text-white" : "bg-white border-[#E7E7E2] text-red"
                      }`}
                    >
                      <XIcon size={14} /> Absent
                    </button>
                  </form>
                </div>
              )}
            </ParentCard>
          ))}
        </div>
      ))}
    </div>
  );
}
