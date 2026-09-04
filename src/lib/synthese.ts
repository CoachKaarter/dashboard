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

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

/** Month-over-month attendance rate and average match minutes, last 6 months. */
export async function getMonthlyTrends(scope: Scope) {
  const now = new Date();
  const months: { key: string; label: string; start: Date; end: Date }[] = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({ key: `${start.getFullYear()}-${start.getMonth()}`, label: MONTH_LABELS[start.getMonth()], start, end });
  }

  const teamIdWhere = scope === "ALL" ? {} : { teamId: { in: scope } };
  const rangeStart = months[0].start;

  const [attendances, matchStats, scopeCategories] = await Promise.all([
    prisma.attendance.findMany({
      where: { session: { date: { gte: rangeStart } } },
      include: { session: true, player: true },
    }),
    prisma.matchPlayerStat.findMany({
      where: { match: { date: { gte: rangeStart }, ...teamIdWhere } },
      include: { match: true },
    }),
    scope === "ALL"
      ? Promise.resolve(null)
      : prisma.team.findMany({ where: { id: { in: scope } }, select: { category: true } }).then((ts) => new Set(ts.map((t) => t.category))),
  ]);

  // A player with no fixed team (Player.teamId null) is still in scope
  // whenever their category is.
  const scopedAttendances =
    scope === "ALL"
      ? attendances
      : attendances.filter((a) => (a.player.teamId !== null && scope.includes(a.player.teamId)) || scopeCategories!.has(a.player.category));

  return months.map((m) => {
    const monthAtt = scopedAttendances.filter((a) => a.session.date >= m.start && a.session.date < m.end);
    const presents = monthAtt.filter((a) => a.code === "P").length;
    const attendanceRate = monthAtt.length ? Math.round((100 * presents) / monthAtt.length) : null;

    const monthStats = matchStats.filter((s) => s.match.date >= m.start && s.match.date < m.end);
    const avgMinutes = monthStats.length ? Math.round(monthStats.reduce((sum, s) => sum + s.minutes, 0) / monthStats.length) : null;

    return { label: m.label, attendanceRate, avgMinutes };
  });
}
