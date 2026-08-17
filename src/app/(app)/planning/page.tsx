import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FilterChip } from "@/components/ui/FilterChip";
import { TeamChip } from "@/components/ui/TeamChip";
import { TEAM_FILTERS } from "@/lib/constants";
import { toQueryString } from "@/lib/query";
import { getPlanEvents, KIND_COLOR, startOfWeek, startOfMonth } from "@/lib/planning";
import { formatDateShort } from "@/lib/format";
import { requireUser, scopedTeamIds } from "@/lib/authz";

const VIEWS = ["semaine", "mois", "agenda"];
const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const DAY_NAMES_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; team?: string; week?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const view = VIEWS.includes(sp.view ?? "") ? sp.view! : "semaine";
  const team = sp.team ?? "Toutes";
  const weekOffset = Number(sp.week ?? 0) || 0;
  const monthOffset = Number(sp.month ?? 0) || 0;

  const user = await requireUser();
  const scope = scopedTeamIds(user);
  let allowed: string[] | "ALL" = "ALL";
  if (scope !== "ALL") {
    const teams = await prisma.team.findMany({ where: { id: { in: scope } } });
    allowed = teams.map((t) => t.code);
  }
  const visibleTeamFilters = allowed === "ALL" ? TEAM_FILTERS : ["Toutes", ...allowed];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseHref = (patch: Record<string, string | undefined>) =>
    toQueryString({ view: sp.view, team: sp.team, week: sp.week, month: sp.month, ...patch });

  return (
    <div className="max-w-[1620px] mx-auto animate-fadein">
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        {VIEWS.map((v) => (
          <FilterChip key={v} href={baseHref({ view: v === "semaine" ? undefined : v })} active={view === v}>
            {v[0].toUpperCase() + v.slice(1)}
          </FilterChip>
        ))}
        <div className="w-px h-[22px] bg-line mx-1" />
        {visibleTeamFilters.map((t) => (
          <FilterChip key={t} href={baseHref({ team: t === "Toutes" ? undefined : t })} active={team === t}>
            {t}
          </FilterChip>
        ))}
        <span className="flex-1" />
        <Link
          href="/planning/nouveau"
          className="h-8 px-3 border border-line rounded-md bg-[#FCFCFB] text-xs font-semibold text-ink-soft flex items-center hover:border-ink hover:text-ink"
        >
          + Nouvel événement
        </Link>
      </div>

      {view === "semaine" && <WeekView team={team} weekOffset={weekOffset} today={today} baseHref={baseHref} allowed={allowed} />}
      {view === "mois" && <MonthView team={team} monthOffset={monthOffset} today={today} baseHref={baseHref} allowed={allowed} />}
      {view === "agenda" && <AgendaView team={team} today={today} allowed={allowed} />}
    </div>
  );
}

async function WeekView({
  team,
  weekOffset,
  today,
  baseHref,
  allowed,
}: {
  team: string;
  weekOffset: number;
  today: Date;
  baseHref: (p: Record<string, string | undefined>) => string;
  allowed: string[] | "ALL";
}) {
  const monday = startOfWeek(today);
  monday.setDate(monday.getDate() + weekOffset * 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 7);

  const events = await getPlanEvents(monday, sunday, team, allowed);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });

  const label = `Semaine du ${formatDateShort(monday)} au ${formatDateShort(new Date(sunday.getTime() - 86400000))}`;

  return (
    <>
      <div className="flex items-center justify-between mb-2.5">
        <Link href={baseHref({ week: String(weekOffset - 1) })} className="text-xs text-muted hover:text-ink px-2 py-1">
          ← Semaine précédente
        </Link>
        <div className="text-[12.5px] text-muted">{label}</div>
        <Link href={baseHref({ week: String(weekOffset + 1) })} className="text-xs text-muted hover:text-ink px-2 py-1">
          Semaine suivante →
        </Link>
      </div>
      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const isToday = d.getTime() === today.getTime();
            return (
              <div
                key={i}
                className={`px-2.5 py-2 border-b border-line text-[11.5px] ${i > 0 ? "border-l border-line-soft" : ""} ${
                  isToday ? "font-bold text-ink bg-[#F2F5F1]" : "font-semibold text-muted bg-[#FAFAF8]"
                }`}
              >
                {DAY_NAMES[i]} {d.getDate()}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const isToday = d.getTime() === today.getTime();
            const dayEvents = events.filter((e) => e.date.toDateString() === d.toDateString());
            return (
              <div
                key={i}
                className={`min-h-[340px] p-2 flex flex-col gap-1.5 ${i > 0 ? "border-l border-line-soft" : ""} ${
                  isToday ? "bg-[#FCFDFB]" : "bg-surface"
                }`}
              >
                {dayEvents.map((e) => {
                  const c = KIND_COLOR[e.kind];
                  return (
                    <Link
                      key={e.id}
                      href={e.href}
                      className="rounded-md px-2.5 py-[7px] cursor-pointer block"
                      style={{ borderLeft: `3px solid ${c.fg}`, background: c.bg }}
                    >
                      <div className="font-mono text-[10.5px] text-ink-soft">
                        {e.start}
                        {e.end && ` › ${e.end}`}
                      </div>
                      <div className="text-xs font-semibold mt-0.5">{e.title}</div>
                      <div className="text-[11px] text-muted mt-0.5">{e.lieu}</div>
                      <div className="mt-[5px]">
                        <TeamChip code={e.team} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

async function MonthView({
  team,
  monthOffset,
  today,
  baseHref,
  allowed,
}: {
  team: string;
  monthOffset: number;
  today: Date;
  baseHref: (p: Record<string, string | undefined>) => string;
  allowed: string[] | "ALL";
}) {
  const monthStart = startOfMonth(today);
  monthStart.setMonth(monthStart.getMonth() + monthOffset);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + 42);

  const events = await getPlanEvents(gridStart, gridEnd, team, allowed);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <>
      <div className="flex items-center justify-between mb-2.5">
        <Link href={baseHref({ month: String(monthOffset - 1) })} className="text-xs text-muted hover:text-ink px-2 py-1">
          ← Mois précédent
        </Link>
        <div className="text-[13px] font-semibold">
          {MONTH_NAMES[monthStart.getMonth()]} {monthStart.getFullYear()}
        </div>
        <Link href={baseHref({ month: String(monthOffset + 1) })} className="text-xs text-muted hover:text-ink px-2 py-1">
          Mois suivant →
        </Link>
      </div>
      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className="grid grid-cols-7 bg-[#FAFAF8] border-b border-line">
          {DAY_NAMES_SHORT.map((n) => (
            <div key={n} className="px-2 py-[7px] text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted">
              {n}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === monthStart.getMonth();
            const isToday = d.toDateString() === today.toDateString();
            const dayEvents = events.filter((e) => e.date.toDateString() === d.toDateString());
            return (
              <div
                key={i}
                className={`min-h-[96px] border-r border-b border-line-soft px-[7px] py-1.5 ${
                  !inMonth ? "bg-[#FAFAF8]" : isToday ? "bg-[#FCFDFB]" : "bg-surface"
                }`}
              >
                <div className={`font-mono text-[11px] mb-1 ${isToday ? "font-bold text-green" : inMonth ? "text-muted-2" : "text-muted-2/50"}`}>
                  {d.getDate()}
                </div>
                {dayEvents.slice(0, 3).map((e) => {
                  const c = KIND_COLOR[e.kind];
                  return (
                    <Link
                      key={e.id}
                      href={e.href}
                      className="block text-[10.5px] font-semibold px-1.5 py-0.5 rounded mb-[3px] truncate"
                      style={{ color: c.fg, background: c.bg }}
                    >
                      {e.title}
                    </Link>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-2 font-semibold px-1.5">+{dayEvents.length - 3} autres</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

async function AgendaView({ team, today, allowed }: { team: string; today: Date; allowed: string[] | "ALL" }) {
  const from = today;
  const to = new Date(today);
  to.setDate(to.getDate() + 45);
  const events = await getPlanEvents(from, to, team, allowed);

  return (
    <div className="bg-surface border border-line rounded-lg overflow-auto">
      {events.map((e) => {
        const c = KIND_COLOR[e.kind];
        return (
          <Link
            key={e.id}
            href={e.href}
            className="grid grid-cols-[150px_120px_minmax(0,1fr)_200px_80px] gap-3 items-center px-3.5 py-[11px] border-b border-line-soft-2 last:border-b-0 text-[12.5px] hover:bg-bg/60"
          >
            <div className="text-muted">
              {DAY_NAMES[(e.date.getDay() + 6) % 7]} {e.date.getDate()} {MONTH_NAMES[e.date.getMonth()].slice(0, 4)}.
            </div>
            <div className="font-mono text-[11.5px]">
              {e.start}
              {e.end && ` › ${e.end}`}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: c.fg }} />
              <span className="font-semibold">{e.title}</span>
            </div>
            <div className="text-muted truncate">{e.lieu}</div>
            <div>
              <TeamChip code={e.team} />
            </div>
          </Link>
        );
      })}
      {events.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">Aucun événement à venir.</div>}
    </div>
  );
}
