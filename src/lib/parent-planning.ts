import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/availability";
import type { AuthedParent } from "@/lib/parent-session";

export type ParentPlanStatus = "entrainement" | "annule" | "aRepondre" | "dispoAVenir" | "convoque" | "neutral";

export type ParentPlanItem = {
  date: Date;
  kind: "entrainement" | "weekend" | "convocation";
  label: string;
  sub?: string;
  matchId?: string;
  confirmed?: boolean | null;
  answer?: string; // "AVAILABLE" | "UNAVAILABLE"
  weekStartIso?: string;
  windowStatus?: "OPEN" | "LOCKED" | "CLOSED"; // "weekend" items only — raw WeeklyAvailabilityWindow state, independent of whether already answered
  status: ParentPlanStatus;
};

/**
 * The one place that decides what a parent's calendar shows. A match is
 * visible in full (adversaire, horaire, lieu, équipe) only once
 * MatchConvocation exists for THEIR child — never via Match.teamId /
 * parent.player.teamId. Before that, a Saturday with football happening
 * shows only a generic placeholder. Every view (Semaine/Mois/Agenda on
 * /parent/planning, and /parent/matchs) renders from this same list, so the
 * security boundary lives in exactly one function.
 */
export async function getParentPlanItems(parent: AuthedParent, from: Date, to: Date): Promise<ParentPlanItem[]> {
  const [sessions, myConvocations, myAvailability] = await Promise.all([
    prisma.trainingSession.findMany({
      where: {
        date: { gte: from, lt: to },
        deletedAt: null,
        OR: [{ scopeTeamId: parent.player.teamId }, { scopeTeamId: null, category: parent.player.teamCategory }],
      },
      orderBy: { date: "asc" },
    }),
    // Convocation OFFICIELLE du staff pour CE joueur uniquement — jamais la
    // liste des autres convoqués, jamais une lecture de Match par teamId.
    prisma.matchConvocation.findMany({
      where: { playerId: parent.playerId, match: { date: { gte: from, lt: to } } },
      include: { match: true },
    }),
    prisma.playerAvailability.findMany({
      where: { playerId: parent.playerId, eventDate: { gte: from, lt: to } },
    }),
  ]);
  const convocByDateKey = new Map(myConvocations.map((c) => [c.match.date.toISOString().slice(0, 10), c]));
  const availByDateKey = new Map(myAvailability.filter((a) => a.type === "WEEKEND").map((a) => [a.eventDate.toISOString().slice(0, 10), a]));
  const availBySession = new Map(myAvailability.filter((a) => a.sessionId).map((a) => [a.sessionId as string, a]));

  // Every Saturday in range is a potential match day. When no official
  // convocation exists yet for THIS child, deliberately keep it anonymous —
  // the parent only declares "disponible ce week-end", never which team.
  const saturdays: Date[] = [];
  for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 6) saturdays.push(new Date(d));
  }
  const weekendWindows = saturdays.length
    ? await prisma.weeklyAvailabilityWindow.findMany({ where: { weekStartDate: { in: saturdays.map((d) => getWeekStart(d)) } } })
    : [];
  const windowByWeekStart = new Map(weekendWindows.map((w) => [w.weekStartDate.toISOString(), w]));

  const items: ParentPlanItem[] = [
    ...sessions.map((s) => ({
      date: s.date,
      kind: "entrainement" as const,
      label: "Entraînement",
      sub: `${s.startTime} · ${s.location}`,
      answer: availBySession.get(s.id)?.status,
      status: (s.status === "Annulée" ? "annule" : "entrainement") as ParentPlanStatus,
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
          matchId: conv.matchId,
          confirmed: conv.confirmed,
          status: "convoque" as ParentPlanStatus,
        };
      }
      const answer = availByDateKey.get(d.toISOString().slice(0, 10))?.status;
      const weekWindow = windowByWeekStart.get(getWeekStart(d).toISOString());
      const windowStatus: "OPEN" | "LOCKED" | "CLOSED" = (weekWindow?.status as "OPEN" | "LOCKED" | undefined) ?? "CLOSED";
      const status: ParentPlanStatus = answer ? "neutral" : windowStatus === "OPEN" ? "aRepondre" : "dispoAVenir";
      return {
        date: d,
        kind: "weekend" as const,
        label: "Match",
        sub: "Informations à venir",
        answer,
        weekStartIso: getWeekStart(d).toISOString(),
        windowStatus,
        status,
      };
    }),
  ];
  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
