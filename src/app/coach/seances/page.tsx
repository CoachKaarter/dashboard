import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession } from "@/lib/authz";
import { parisStartOfDay } from "@/lib/timezone";
import { addDays, getWeekStart } from "@/lib/availability";
import { Badge } from "@/components/ui/Badge";

const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export default async function CoachSeancesPage() {
  const user = await requireUser();
  const today = parisStartOfDay(new Date());
  const weekEnd = addDays(getWeekStart(today), 7);
  const rangeStart = addDays(today, -21);
  const rangeEnd = addDays(today, 60);

  const raw = await prisma.trainingSession.findMany({
    where: { date: { gte: rangeStart, lt: rangeEnd }, status: { not: "Annulée" } },
    include: { scopeTeam: true, attendances: true },
    orderBy: { date: "asc" },
  });
  const sessions = [];
  for (const s of raw) {
    if (await canAccessSession(user, s)) sessions.push(s);
  }

  const withCounts = await Promise.all(
    sessions.map(async (s) => {
      const total = await prisma.player.count({
        where: s.scopeTeamId ? { teamId: s.scopeTeamId, archived: false } : { team: { category: s.category }, archived: false },
      });
      return { ...s, playerTotal: total, pointed: s.attendances.length };
    })
  );

  const todayList = withCounts.filter((s) => s.date.getTime() === today.getTime());
  const weekList = withCounts.filter((s) => s.date > today && s.date < weekEnd);
  const upcomingList = withCounts.filter((s) => s.date >= weekEnd);
  const recentList = withCounts.filter((s) => s.date < today).sort((a, b) => b.date.getTime() - a.date.getTime());

  const groups: { title: string; items: typeof withCounts }[] = [
    { title: "Aujourd'hui", items: todayList },
    { title: "Cette semaine", items: weekList },
    { title: "À venir", items: upcomingList.slice(0, 8) },
    { title: "Récentes", items: recentList.slice(0, 8) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <div className="text-[22px] font-bold tracking-[-0.01em]">Séances</div>

      {groups.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E7E7E2] p-6 text-center text-[14px] text-[#6E7178]">
          Aucune séance dans ton périmètre.
        </div>
      )}

      {groups.map((g) => (
        <div key={g.title} className="flex flex-col gap-2.5">
          <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-1">{g.title}</div>
          {g.items.map((s) => {
            const complete = s.pointed >= s.playerTotal && s.playerTotal > 0;
            return (
              <Link
                key={s.id}
                href={`/coach/seances/${s.id}`}
                className="bg-white rounded-2xl border border-[#E7E7E2] p-4 flex items-center gap-3 active:bg-[#FAFAF8] transition-colors duration-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold tracking-[0.06em] uppercase text-green">
                      {s.scopeTeam ? s.scopeTeam.code : s.category}
                    </span>
                    {g.title !== "Aujourd'hui" && (
                      <span className="text-[11.5px] text-[#9A9DA3]">
                        {DAY_NAMES[s.date.getDay()]} {s.date.getDate()} {MONTHS[s.date.getMonth()]}
                      </span>
                    )}
                  </div>
                  <div className="text-[14.5px] font-bold mt-0.5">{s.label}</div>
                  <div className="text-[12.5px] text-[#6E7178] mt-0.5">
                    {s.startTime} · {s.location}
                  </div>
                  <div className={`text-[12px] font-semibold mt-1 ${complete ? "text-green" : "text-[#8A8D93]"}`}>
                    {s.pointed} / {s.playerTotal} pointés
                  </div>
                </div>
                {complete && <Badge tone="green">Complet</Badge>}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
