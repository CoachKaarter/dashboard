import Link from "next/link";
import { requireParentReady } from "@/lib/parent-guard";
import { getParentPlanItems, type ParentPlanItem, type ParentPlanStatus } from "@/lib/parent-planning";
import { PARENT_PLAN_STATUS_STYLE as STATUS_STYLE } from "@/lib/parent-plan-status";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon, XIcon } from "@/components/parent/icons";
import type { AuthedParent } from "@/lib/parent-session";
import { confirmMyConvocation } from "./actions";

function StatusChip({ status }: { status: ParentPlanStatus }) {
  const s = STATUS_STYLE[status];
  if (!s.label) return null;
  return <span className={`shrink-0 text-[10px] font-bold tracking-[0.05em] px-2 h-[19px] rounded-full flex items-center ${s.chip}`}>{s.label}</span>;
}

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const DAY_NAMES_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const VUES = [
  { key: "semaine", label: "Semaine" },
  { key: "mois", label: "Mois" },
  { key: "agenda", label: "Agenda" },
] as const;
type Vue = (typeof VUES)[number]["key"];

function mondayOf(d: Date) {
  const r = new Date(d);
  const diff = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - diff);
  return r;
}
function monthParam(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function dateParam(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fromDateParam(s: string) {
  return new Date(s);
}
function fmtDayFull(d: Date) {
  return `${DAY_NAMES_FULL[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].toLowerCase()}`;
}

type SP = { vue?: string; week?: string; month?: string; day?: string };

export default async function ParentPlanningPage({ searchParams }: { searchParams: Promise<SP> }) {
  const parent = await requireParentReady();
  const sp = await searchParams;
  const vue: Vue = VUES.some((v) => v.key === sp.vue) ? (sp.vue as Vue) : "semaine";

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader title="Planning" />

      <div className="flex gap-1 bg-white rounded-2xl border border-[#E7E7E2] p-1">
        {VUES.map((v) => (
          <Link
            key={v.key}
            href={`/parent/planning?vue=${v.key}`}
            className={`flex-1 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold transition-colors duration-150 ${
              vue === v.key ? "bg-[#16181C] text-white" : "text-[#6E7178] active:bg-[#F6F6F4]"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {vue === "semaine" && <WeekView parent={parent} sp={sp} />}
      {vue === "mois" && <MonthView parent={parent} sp={sp} />}
      {vue === "agenda" && <AgendaView parent={parent} />}
    </div>
  );
}

async function WeekView({ parent, sp }: { parent: AuthedParent; sp: SP }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? mondayOf(fromDateParam(sp.week)) : mondayOf(today);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndDisplay = new Date(weekEnd);
  weekEndDisplay.setDate(weekEndDisplay.getDate() - 1);

  const items = await getParentPlanItems(parent, weekStart, weekEnd);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const itemsByDay = new Map(days.map((d) => [dateParam(d), items.filter((it) => dateParam(it.date) === dateParam(d))]));

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const todayKey = dateParam(today);
  const requestedDay = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null;
  const selectedKey =
    requestedDay && days.some((d) => dateParam(d) === requestedDay)
      ? requestedDay
      : days.some((d) => dateParam(d) === todayKey)
        ? todayKey
        : dateParam(weekStart);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E7E7E2] px-2 py-1.5">
        <Link
          href={`/parent/planning?vue=semaine&week=${dateParam(prevWeek)}`}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#6E7178] active:bg-[#F6F6F4] active:scale-90 transition-all duration-100"
          aria-label="Semaine précédente"
        >
          <ChevronLeftIcon size={19} />
        </Link>
        <div className="text-[13.5px] font-bold">
          Semaine du {weekStart.getDate()} au {weekEndDisplay.getDate()} {MONTHS[weekEndDisplay.getMonth()].toLowerCase()}
        </div>
        <Link
          href={`/parent/planning?vue=semaine&week=${dateParam(nextWeek)}`}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#6E7178] active:bg-[#F6F6F4] active:scale-90 transition-all duration-100"
          aria-label="Semaine suivante"
        >
          <ChevronRightIcon size={19} />
        </Link>
      </div>

      {/* Desktop / tablette : vraie grille 7 colonnes */}
      <div className="hidden md:grid grid-cols-7 gap-2">
        {days.map((d) => {
          const key = dateParam(d);
          const dayItems = itemsByDay.get(key) ?? [];
          return (
            <div key={key} className="flex flex-col gap-2">
              <div className={`text-center text-[11px] font-bold uppercase tracking-[0.05em] py-1.5 rounded-lg ${key === todayKey ? "bg-green-bg text-green" : "text-[#9A9DA3]"}`}>
                {DAY_NAMES[d.getDay()]} {d.getDate()}
              </div>
              <div className="flex flex-col gap-1.5 min-h-[64px]">
                {dayItems.map((it, i) => (
                  <CompactEventCard key={i} item={it} />
                ))}
                {dayItems.length === 0 && <div className="text-[11px] text-[#C9CBC7] text-center py-3">—</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile : sélecteur de jour horizontal + liste verticale du jour choisi */}
      <div className="md:hidden flex flex-col gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {days.map((d) => {
            const key = dateParam(d);
            const active = key === selectedKey;
            const has = (itemsByDay.get(key) ?? []).length > 0;
            return (
              <Link
                key={key}
                href={`/parent/planning?vue=semaine&week=${dateParam(weekStart)}&day=${key}`}
                className={`shrink-0 w-[50px] flex flex-col items-center gap-1 py-2 rounded-xl border transition-colors duration-150 ${
                  active ? "bg-[#16181C] border-[#16181C] text-white" : "bg-white border-[#E7E7E2] text-[#16181C]"
                }`}
              >
                <span className={`text-[9.5px] font-bold uppercase tracking-[0.04em] ${active ? "text-white/70" : "text-[#9A9DA3]"}`}>{DAY_NAMES[d.getDay()]}</span>
                <span className="text-[15px] font-bold">{d.getDate()}</span>
                <span className={`w-1 h-1 rounded-full ${has ? (active ? "bg-white" : "bg-green") : "bg-transparent"}`} />
              </Link>
            );
          })}
        </div>
        <div className="flex flex-col gap-2.5">
          {(itemsByDay.get(selectedKey) ?? []).length === 0 && (
            <ParentCard className="text-center py-8">
              <div className="text-[14px] text-[#6E7178]">Rien de prévu ce jour-là.</div>
            </ParentCard>
          )}
          {(itemsByDay.get(selectedKey) ?? []).map((it, i) => (
            <EventCard key={i} item={it} />
          ))}
        </div>
      </div>
    </div>
  );
}

async function MonthView({ parent, sp }: { parent: AuthedParent; sp: SP }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? new Date(`${sp.month}-01`) : new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = mondayOf(monthStart);
  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridEnd.getDate() + 42);

  const items = await getParentPlanItems(parent, gridStart, gridEnd);
  const itemsByDay = new Map<string, ParentPlanItem[]>();
  for (const it of items) {
    const k = dateParam(it.date);
    if (!itemsByDay.has(k)) itemsByDay.set(k, []);
    itemsByDay.get(k)!.push(it);
  }

  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  const todayKey = dateParam(today);
  const requestedDay = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null;
  const inMonth = (d: Date) => d.getMonth() === month.getMonth();
  const selectedKey =
    requestedDay && cells.some((d) => dateParam(d) === requestedDay && inMonth(d))
      ? requestedDay
      : cells.some((d) => dateParam(d) === todayKey && inMonth(d))
        ? todayKey
        : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E7E7E2] px-2 py-1.5">
        <Link
          href={`/parent/planning?vue=mois&month=${monthParam(prevMonth)}`}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#6E7178] active:bg-[#F6F6F4] active:scale-90 transition-all duration-100"
          aria-label="Mois précédent"
        >
          <ChevronLeftIcon size={19} />
        </Link>
        <div className="text-[14.5px] font-bold">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </div>
        <Link
          href={`/parent/planning?vue=mois&month=${monthParam(nextMonth)}`}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[#6E7178] active:bg-[#F6F6F4] active:scale-90 transition-all duration-100"
          aria-label="Mois suivant"
        >
          <ChevronRightIcon size={19} />
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-[#E7E7E2] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#EFEFEC]">
          {DAY_NAMES.map((n) => (
            <div key={n} className="text-center text-[9.5px] font-bold uppercase tracking-[0.05em] text-[#9A9DA3] py-2">
              {n}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d) => {
            const key = dateParam(d);
            const dayItems = itemsByDay.get(key) ?? [];
            const hasCancelled = dayItems.length > 0 && dayItems.every((it) => it.status === "annule");
            return (
              <Link
                key={key}
                href={`/parent/planning?vue=mois&month=${monthParam(month)}&day=${key}`}
                className={`aspect-square flex flex-col items-center justify-center gap-1 border-b border-r border-[#EFEFEC] transition-colors duration-100 ${
                  !inMonth(d) ? "opacity-30" : ""
                } ${selectedKey === key ? "bg-green-bg" : ""}`}
              >
                <span className={`text-[12.5px] ${key === todayKey ? "font-bold text-green" : "font-semibold text-[#16181C]"}`}>{d.getDate()}</span>
                {dayItems.length > 0 && <span className={`w-1.5 h-1.5 rounded-full ${hasCancelled ? "bg-[#C9CBC7]" : "bg-green"}`} />}
              </Link>
            );
          })}
        </div>
      </div>

      {selectedKey && (
        <div className="flex flex-col gap-2.5">
          <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3]">{fmtDayFull(fromDateParam(selectedKey))}</div>
          {(itemsByDay.get(selectedKey) ?? []).length === 0 && (
            <ParentCard className="text-center py-6">
              <div className="text-[13.5px] text-[#6E7178]">Rien de prévu ce jour-là.</div>
            </ParentCard>
          )}
          {(itemsByDay.get(selectedKey) ?? []).map((it, i) => (
            <EventCard key={i} item={it} showDate={false} />
          ))}
        </div>
      )}
    </div>
  );
}

async function AgendaView({ parent }: { parent: AuthedParent }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(today);
  to.setDate(to.getDate() + 45);
  const items = await getParentPlanItems(parent, today, to);

  const groups = new Map<string, ParentPlanItem[]>();
  for (const it of items) {
    const k = dateParam(it.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  const keys = [...groups.keys()].sort();

  return (
    <div className="flex flex-col gap-4">
      {keys.length === 0 && (
        <ParentCard className="text-center py-8">
          <div className="text-[14px] text-[#6E7178]">Rien de prévu pour l&apos;instant.</div>
        </ParentCard>
      )}
      {keys.map((k) => (
        <div key={k} className="flex flex-col gap-2">
          <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-1">{fmtDayFull(fromDateParam(k))}</div>
          {groups.get(k)!.map((it, i) => (
            <EventCard key={i} item={it} showDate={false} />
          ))}
        </div>
      ))}
    </div>
  );
}

function CompactEventCard({ item }: { item: ParentPlanItem }) {
  const s = STATUS_STYLE[item.status];
  return (
    <div className="rounded-lg border-l-[3px] px-2 py-1.5 bg-[#FAFAF8]" style={{ borderLeftColor: s.borderColor }}>
      <div className={`text-[10.5px] font-bold leading-tight ${item.status === "annule" ? "line-through text-[#9A9DA3]" : ""}`}>{item.label}</div>
      {item.sub && <div className="text-[9.5px] text-[#9A9DA3] mt-0.5 truncate">{item.sub}</div>}
    </div>
  );
}

function EventCard({ item, showDate = true }: { item: ParentPlanItem; showDate?: boolean }) {
  const s = STATUS_STYLE[item.status];
  return (
    <ParentCard className="flex items-center gap-3 flex-wrap" style={{ borderLeftWidth: 4, borderLeftColor: s.borderColor }}>
      {showDate && (
        <div className="w-12 text-center shrink-0">
          <div className="text-[10px] uppercase tracking-[0.06em] text-[#8A8D93]">{DAY_NAMES[item.date.getDay()]}</div>
          <div className="text-[19px] font-bold">{item.date.getDate()}</div>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-[14.5px] font-bold ${item.status === "annule" ? "line-through text-[#9A9DA3]" : ""}`}>{item.label}</div>
        {item.sub && <div className={`text-[12.5px] mt-0.5 ${item.status === "annule" ? "line-through text-[#B5B7BB]" : "text-[#6E7178]"}`}>{item.sub}</div>}
        {item.program && (
          <div className="text-[12.5px] text-[#6E7178] mt-1.5 whitespace-pre-wrap leading-relaxed">{item.program}</div>
        )}
        {item.kind !== "convocation" && item.answer && (
          <div className={`flex items-center gap-1 text-[12px] font-semibold mt-1 ${item.answer === "AVAILABLE" ? "text-green" : "text-red"}`}>
            {item.answer === "AVAILABLE" ? <CheckIcon size={12} /> : <XIcon size={12} />}
            {item.kind === "weekend" ? (item.answer === "AVAILABLE" ? "Disponible" : "Indisponible") : item.answer === "AVAILABLE" ? "Présent" : "Absent"}
          </div>
        )}
      </div>
      <StatusChip status={item.status} />
      {item.kind === "convocation" && item.matchId && (
        <div className="flex gap-1.5 w-full sm:w-auto">
          <form action={confirmMyConvocation.bind(null, item.matchId, true)} className="flex-1 sm:flex-none">
            <button
              type="submit"
              className={`w-full h-9 px-3 rounded-lg text-[12px] font-bold border-2 inline-flex items-center justify-center gap-1 active:scale-95 transition-all duration-150 ${
                item.confirmed === true ? "bg-green border-green text-white" : "bg-white border-[#E7E7E2] text-green"
              }`}
            >
              <CheckIcon size={14} /> Je viens
            </button>
          </form>
          <form action={confirmMyConvocation.bind(null, item.matchId, false)} className="flex-1 sm:flex-none">
            <button
              type="submit"
              className={`w-full h-9 px-3 rounded-lg text-[12px] font-bold border-2 inline-flex items-center justify-center gap-1 active:scale-95 transition-all duration-150 ${
                item.confirmed === false ? "bg-red border-red text-white" : "bg-white border-[#E7E7E2] text-red"
              }`}
            >
              <XIcon size={14} /> Absent
            </button>
          </form>
        </div>
      )}
    </ParentCard>
  );
}
