import { prisma } from "@/lib/prisma";

export type PlanEvent = {
  id: string;
  kind: "seance" | "match" | "reunion" | "tournoi" | "autre";
  date: Date;
  start: string;
  end: string;
  title: string;
  lieu: string;
  team: string;
  href: string;
};

export const KIND_COLOR: Record<PlanEvent["kind"], { fg: string; bg: string }> = {
  seance: { fg: "#3C6E9F", bg: "#EDF2F8" },
  match: { fg: "#3F8F5B", bg: "#ECF5EF" },
  reunion: { fg: "#7A5AA6", bg: "#F2EEF8" },
  tournoi: { fg: "#C97A17", bg: "#FDF3E4" },
  autre: { fg: "#6E7178", bg: "#F1F1EE" },
};

function visible(eventTeam: string, filterTeam: string): boolean {
  if (filterTeam === "Toutes" || eventTeam === "Toutes") return true;
  return eventTeam === filterTeam || eventTeam.startsWith(filterTeam) || filterTeam.startsWith(eventTeam);
}

export async function getPlanEvents(from: Date, to: Date, team: string): Promise<PlanEvent[]> {
  const [sessions, matches, calEvents] = await Promise.all([
    prisma.trainingSession.findMany({ where: { date: { gte: from, lt: to } }, include: { scopeTeam: true } }),
    prisma.match.findMany({ where: { date: { gte: from, lt: to } }, include: { team: true } }),
    prisma.calendarEvent.findMany({ where: { date: { gte: from, lt: to } }, include: { team: true } }),
  ]);

  const events: PlanEvent[] = [];
  for (const s of sessions) {
    const eTeam = s.scopeTeam?.code ?? s.category;
    if (!visible(eTeam, team)) continue;
    events.push({
      id: `s-${s.id}`, kind: "seance", date: s.date, start: s.startTime, end: s.endTime,
      title: `${eTeam} — ${s.label}`, lieu: s.location, team: eTeam, href: `/seances/${s.id}`,
    });
  }
  for (const m of matches) {
    if (!visible(m.team.code, team)) continue;
    events.push({
      id: `m-${m.id}`, kind: "match", date: m.date, start: m.time ?? "—", end: "",
      title: m.opponent ?? "Match à programmer", lieu: m.location ?? "lieu à définir", team: m.team.code, href: `/matchs/${m.id}`,
    });
  }
  for (const e of calEvents) {
    const eTeam = e.team?.code ?? e.teamLabel;
    if (!visible(eTeam, team)) continue;
    events.push({
      id: `c-${e.id}`, kind: e.kind as PlanEvent["kind"], date: e.date, start: e.startTime, end: e.endTime,
      title: e.title, lieu: e.location ?? "lieu à définir", team: eTeam, href: "/planning",
    });
  }
  return events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.start.localeCompare(b.start));
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  return x;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
