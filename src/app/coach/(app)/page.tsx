import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessSession, canAccessTeam, scopedTeamIds } from "@/lib/authz";
import { parisStartOfDay } from "@/lib/timezone";
import { addDays } from "@/lib/availability";
import { CoachHeader } from "@/components/coach/CoachHeader";
import { TodaySessionCard } from "@/components/coach/TodaySessionCard";
import { CheckIcon } from "@/components/coach/icons";
import { ensureSessionExpectations, computeRosterSummary } from "@/lib/session-expectation";

const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export default async function CoachTodayPage() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const today = parisStartOfDay(new Date());
  const tomorrow = addDays(today, 1);

  const allTodaySessions = await prisma.trainingSession.findMany({
    where: { date: { gte: today, lt: tomorrow }, status: { not: "Annulée" } },
    include: { scopeTeam: true },
    orderBy: { startTime: "asc" },
  });
  const todaySessions = [];
  for (const s of allTodaySessions) {
    if (await canAccessSession(user, s)) todaySessions.push(s);
  }

  const cards = await Promise.all(
    todaySessions.map(async (s) => {
      await ensureSessionExpectations(s.id);
      const [expectations, availabilities] = await Promise.all([
        prisma.sessionExpectation.findMany({ where: { sessionId: s.id }, select: { playerId: true, expected: true } }),
        prisma.playerAvailability.findMany({ where: { sessionId: s.id, type: "TRAINING" }, select: { playerId: true, status: true } }),
      ]);
      const summary = computeRosterSummary(
        expectations,
        availabilities.filter((a): a is { playerId: string; status: "AVAILABLE" | "UNAVAILABLE" } => a.status === "AVAILABLE" || a.status === "UNAVAILABLE")
      );
      return {
        id: s.id,
        teamLabel: s.scopeTeam ? s.scopeTeam.code : s.category,
        label: s.label,
        startTime: s.startTime,
        endTime: s.endTime,
        location: s.location,
        ...summary,
      };
    })
  );

  // "À venir" — un aperçu léger, pas un dashboard : juste la prochaine
  // séance et le prochain match dans le scope du coach.
  const upcomingSessionsRaw = await prisma.trainingSession.findMany({
    where: { date: { gt: today }, status: "Prévue" },
    include: { scopeTeam: true },
    orderBy: { date: "asc" },
    take: 10,
  });
  let nextSession = null;
  for (const s of upcomingSessionsRaw) {
    if (await canAccessSession(user, s)) {
      nextSession = s;
      break;
    }
  }

  const upcomingMatchesRaw = await prisma.match.findMany({
    where: { date: { gte: today }, status: "Planifié", ...(scope === "ALL" ? {} : { teamId: { in: scope } }) },
    include: { team: true },
    orderBy: { date: "asc" },
    take: 1,
  });
  const nextMatch = upcomingMatchesRaw[0] && canAccessTeam(user, upcomingMatchesRaw[0].teamId) ? upcomingMatchesRaw[0] : null;

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <CoachHeader firstName={user.name.split(" ")[0]} />

      <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-1">Aujourd&apos;hui</div>

      {cards.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E7E7E2] p-6 text-center">
          <div className="text-[#3F8F5B] mb-1 flex justify-center">
            <CheckIcon size={22} />
          </div>
          <div className="text-[14px] text-[#6E7178]">Rien de prévu aujourd&apos;hui.</div>
        </div>
      ) : (
        cards.map((c) => (
          <TodaySessionCard
            key={c.id}
            teamLabel={c.teamLabel}
            label={c.label}
            startTime={c.startTime}
            endTime={c.endTime}
            location={c.location}
            expectedCount={c.expected}
            announcedPresentCount={c.announcedPresent}
            announcedAbsentCount={c.announcedAbsent}
            noResponseCount={c.noResponse}
            href={`/coach/seances/${c.id}`}
          />
        ))
      )}

      {(nextSession || nextMatch) && (
        <>
          <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-2">À venir</div>
          {nextSession && (
            <Link
              href={`/coach/seances/${nextSession.id}`}
              className="bg-white rounded-2xl border border-[#E7E7E2] p-3.5 flex items-center gap-3 active:bg-[#FAFAF8] transition-colors duration-100"
            >
              <div className="w-11 text-center shrink-0">
                <div className="text-[10px] uppercase text-[#9A9DA3]">{DAY_NAMES[nextSession.date.getDay()].slice(0, 3)}</div>
                <div className="text-[17px] font-bold">{nextSession.date.getDate()}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-bold">
                  {nextSession.scopeTeam ? nextSession.scopeTeam.code : nextSession.category} — Entraînement
                </div>
                <div className="text-[12px] text-[#6E7178] mt-0.5">
                  {nextSession.startTime} · {nextSession.location}
                </div>
              </div>
            </Link>
          )}
          {nextMatch && (
            <Link
              href={`/coach/matchs`}
              className="bg-white rounded-2xl border border-[#E7E7E2] p-3.5 flex items-center gap-3 active:bg-[#FAFAF8] transition-colors duration-100"
            >
              <div className="w-11 text-center shrink-0">
                <div className="text-[10px] uppercase text-[#9A9DA3]">{DAY_NAMES[nextMatch.date.getDay()].slice(0, 3)}</div>
                <div className="text-[17px] font-bold">{nextMatch.date.getDate()}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-bold">
                  {nextMatch.team.code} — Match{nextMatch.opponent ? ` vs ${nextMatch.opponent}` : ""}
                </div>
                <div className="text-[12px] text-[#6E7178] mt-0.5">
                  {nextMatch.time ?? ""} {nextMatch.location ? `· ${nextMatch.location}` : ""}
                </div>
              </div>
            </Link>
          )}
        </>
      )}
    </div>
  );
}
