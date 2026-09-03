import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export type PlayerWithStats = Awaited<ReturnType<typeof computeAllPlayerStats>>[number];

async function computeAllPlayerStats() {
  const settings = await getSettings();
  const now = new Date();

  const players = await prisma.player.findMany({
    where: { archived: false },
    include: {
      team: true,
      attendances: { include: { session: true }, orderBy: { session: { date: "desc" } } },
      matchStats: { include: { match: true } },
      convocations: { include: { match: true } },
      evaluations: { orderBy: { createdAt: "desc" } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const minutesByPlayer = new Map<string, number>();
  for (const p of players) {
    minutesByPlayer.set(p.id, p.matchStats.reduce((s, m) => s + m.minutes, 0));
  }
  // Grouped by category, not by Player.teamId: a player floats freely between
  // the teams of their category (U12/U13), so "the team's average minutes"
  // would silently move a player's whole comparison baseline the moment
  // their administrative team assignment changed, even with zero real change
  // in how much they actually play. teamAvgMinutes/ecart below keep their
  // established field names (consumed across alerts.ts, temps-de-jeu,
  // recommend.ts) — only what they're averaged over changes.
  const categoryMinutesTotals = new Map<string, { sum: number; count: number }>();
  for (const p of players) {
    const cur = categoryMinutesTotals.get(p.team.category) ?? { sum: 0, count: 0 };
    cur.sum += minutesByPlayer.get(p.id) ?? 0;
    cur.count += 1;
    categoryMinutesTotals.set(p.team.category, cur);
  }

  const recentCutoff = new Date(now);
  recentCutoff.setDate(recentCutoff.getDate() - settings.periodeTdj);

  return players.map((p) => {
    const seances = p.attendances.length;
    const presents = p.attendances.filter((a) => a.code === "P").length;
    const retards = p.attendances.filter((a) => a.code === "R").length;
    const aj = p.attendances.filter((a) => a.code === "AJ").length;
    const anj = p.attendances.filter((a) => a.code === "ANJ").length;
    const blesses = p.attendances.filter((a) => a.code === "B").length;
    const attendanceRate = seances ? presents / seances : 1;
    const last5 = p.attendances.slice(0, 5).map((a) => ({ code: a.code, date: a.session.date }));

    const recentWindow = p.attendances.slice(0, settings.fenetreSeances);
    const recentAbsences = recentWindow.filter((a) => a.code === "AJ" || a.code === "ANJ" || a.code === "B").length;
    const recentANJ = recentWindow.filter((a) => a.code === "ANJ").length;

    const minutes = minutesByPlayer.get(p.id) ?? 0;
    const minutesRecent = p.matchStats
      .filter((m) => m.match.date >= recentCutoff)
      .reduce((s, m) => s + m.minutes, 0);
    const matchsDispo = p.convocations.length;
    const matchsJoues = p.matchStats.length;
    const titularisations = p.matchStats.filter((m) => m.role === "Titulaire").length;

    const categoryTotals = categoryMinutesTotals.get(p.team.category)!;
    const teamAvgMinutes = categoryTotals.count ? Math.round(categoryTotals.sum / categoryTotals.count) : 0;
    const ecart = minutes - teamAvgMinutes;
    const trend: "décroche" | "en tête" | "stable" =
      matchsJoues >= 2 && minutesRecent < minutes * 0.25
        ? "décroche"
        : ecart > 40
          ? "en tête"
          : "stable";

    const moyenne = (e: { technique: number; tactique: number; physique: number; comportement: number }) =>
      Math.round(((e.technique + e.tactique + e.physique + e.comportement) / 4) * 10) / 10;

    const currentEval = p.evaluations[0]
      ? { ...p.evaluations[0], moyenne: moyenne(p.evaluations[0]) }
      : null;
    const previousEval = p.evaluations[1]
      ? { ...p.evaluations[1], moyenne: moyenne(p.evaluations[1]) }
      : null;
    const lastEvalDaysAgo = currentEval
      ? Math.round((now.getTime() - currentEval.createdAt.getTime()) / 86400000)
      : null;

    const lastConvocDate = p.convocations
      .map((c) => c.match.date)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const lastConvocDaysAgo = lastConvocDate
      ? Math.round((now.getTime() - lastConvocDate.getTime()) / 86400000)
      : null;

    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      name: `${p.firstName} ${p.lastName}`,
      initials: `${p.firstName[0]}${p.lastName[0]}`,
      birthYear: p.birthYear,
      teamId: p.teamId,
      teamCode: p.team.code,
      category: p.team.category,
      position: p.position,
      positionAlt: p.positionAlt,
      foot: p.foot,
      status: p.status,
      joinedLabel: p.joinedLabel,
      seances,
      presents,
      retards,
      aj,
      anj,
      blesses,
      attendanceRate,
      last5,
      recentAbsences,
      recentANJ,
      minutes,
      minutesRecent,
      matchsDispo,
      matchsJoues,
      titularisations,
      teamAvgMinutes,
      ecart,
      trend,
      lastEvalDaysAgo,
      currentEval,
      previousEval,
      lastConvocDaysAgo,
    };
  });
}

export const getAllPlayerStats = cache(computeAllPlayerStats);

export const getPlayerStatsById = cache(async (id: string) => {
  const all = await getAllPlayerStats();
  return all.find((p) => p.id === id) ?? null;
});

// A player floats freely between the teams of their category — so a match's
// candidate pool (who could plausibly be convoked/composed for it) is every
// player in that category, never just the ones nominally on that exact team.
export const getPlayerStatsByCategory = cache(async (category: string) => {
  const all = await getAllPlayerStats();
  return all.filter((p) => p.category === category);
});
