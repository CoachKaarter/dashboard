import { prisma } from "@/lib/prisma";
import { getAlertGroups } from "@/lib/alerts";

type Scope = string[] | "ALL";

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function teamWhere(scope: Scope) {
  return scope === "ALL" ? {} : { teamId: { in: scope } };
}

export async function getTodayDigest(scope: Scope) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);

  const [groups, sessions, matches] = await Promise.all([
    getAlertGroups(scope),
    prisma.trainingSession.findMany({
      where: { date: { gte: today, lt: tomorrow }, status: { not: "Annulée" } },
      include: { scopeTeam: true },
    }),
    prisma.match.findMany({
      where: { ...teamWhere(scope), date: { gte: today, lt: tomorrow }, status: { not: "Annulé" } },
      include: { team: true, convocations: true },
    }),
  ]);

  const priorityAlerts = [
    ...(groups.find((g) => g.key === "urgent")?.items ?? []),
    ...(groups.find((g) => g.key === "traiter")?.items ?? []),
  ].filter((a) => !a.treated);

  return { priorityAlerts, sessions, matches };
}

export async function getWeekendRecap(scope: Scope) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = addDays(today, -7);

  const matches = await prisma.match.findMany({
    where: { ...teamWhere(scope), status: "Joué", date: { gte: since, lt: addDays(today, 1) } },
    include: {
      team: true,
      stats: { include: { player: true }, orderBy: { goals: "desc" } },
    },
    orderBy: { date: "desc" },
  });

  return matches.map((m) => ({
    id: m.id,
    teamCode: m.team.code,
    opponent: m.opponent ?? "adversaire à définir",
    date: m.date,
    scoreFor: m.scoreFor,
    scoreAgainst: m.scoreAgainst,
    result: m.scoreFor === null || m.scoreAgainst === null ? null : m.scoreFor > m.scoreAgainst ? "V" : m.scoreFor === m.scoreAgainst ? "N" : "D",
    scorers: m.stats.filter((s) => s.goals > 0).map((s) => ({ name: `${s.player.firstName} ${s.player.lastName}`, goals: s.goals })),
  }));
}

export async function getWeekRecap(scope: Scope) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const since = addDays(today, -7);

  const sessionsAll = await prisma.trainingSession.findMany({
    where: { status: "Réalisée", date: { gte: since, lt: addDays(today, 1) } },
    include: { scopeTeam: true, attendances: true },
    orderBy: { date: "asc" },
  });

  let allowedCategories: Set<string> | null = null;
  if (scope !== "ALL") {
    const scopedTeams = await prisma.team.findMany({ where: { id: { in: scope } }, select: { category: true } });
    allowedCategories = new Set(scopedTeams.map((t) => t.category));
  }
  const sessions = sessionsAll.filter((s) =>
    scope === "ALL" ? true : s.scopeTeamId ? scope.includes(s.scopeTeamId) : allowedCategories!.has(s.category)
  );

  let totalPresences = 0;
  let totalPointed = 0;
  let totalANJ = 0;
  for (const s of sessions) {
    for (const a of s.attendances) {
      totalPointed++;
      if (a.code === "P") totalPresences++;
      if (a.code === "ANJ") totalANJ++;
    }
  }
  const attendanceRate = totalPointed ? Math.round((100 * totalPresences) / totalPointed) : null;

  return { sessionsCount: sessions.length, attendanceRate, totalANJ, sessions };
}
