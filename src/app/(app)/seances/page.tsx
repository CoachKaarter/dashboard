import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { formatDateShort } from "@/lib/format";
import { requireUser, scopedTeamIdsInCategory } from "@/lib/authz";
import { getActiveCategoryGroup } from "@/lib/active-category";
import { ensureUpcomingSessions } from "@/lib/recurring";

const DAY_NAMES = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const GRID = "grid-cols-[76px_70px_86px_80px_120px_110px_96px_minmax(190px,1fr)_24px]";

export default async function SeancesPage() {
  const user = await requireUser();
  const activeGroup = await getActiveCategoryGroup(user);
  const activeCategories = activeGroup?.categories ?? null;
  const allTeams = await prisma.team.findMany({ select: { id: true, code: true, category: true } });
  const categoryTeamIds = scopedTeamIdsInCategory(user, allTeams, activeCategories);
  await ensureUpcomingSessions();
  const allSessions = await prisma.trainingSession.findMany({
    where: { deletedAt: null },
    include: { scopeTeam: true, _count: { select: { attendances: true } } },
    orderBy: { date: "asc" },
  });
  const sessions = allSessions.filter((s) =>
    s.scopeTeamId ? categoryTeamIds.includes(s.scopeTeamId) : (activeCategories ?? []).includes(s.category)
  );

  const expectedBySession = await Promise.all(
    sessions.map((s) =>
      prisma.player.count({ where: s.scopeTeamId ? { teamId: s.scopeTeamId } : { team: { category: s.category } } })
    )
  );

  return (
    <div className="max-w-[1560px] mx-auto animate-fadein">
      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className={`grid ${GRID} gap-3 px-3.5 h-[34px] items-center bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted`}>
          <div>Séance</div>
          <div>Date</div>
          <div>Jour</div>
          <div>Groupe</div>
          <div>Horaire</div>
          <div>Terrain</div>
          <div>Statut</div>
          <div>Pointage</div>
          <div></div>
        </div>
        {sessions.map((s, i) => {
          const done = s._count.attendances;
          const expected = expectedBySession[i];
          const late = s.status === "Réalisée" && done === 0;
          return (
            <Link
              key={s.id}
              href={`/seances/${s.id}`}
              className={`grid ${GRID} gap-3 px-3.5 h-[42px] items-center border-b border-line-soft-2 last:border-b-0 text-[12.5px] hover:bg-bg/60`}
            >
              <div className="font-mono text-[11.5px] text-muted">{s.id.slice(-6)}</div>
              <div className="font-mono">{formatDateShort(s.date)}</div>
              <div>{DAY_NAMES[s.date.getDay()]}</div>
              <div className="font-semibold">{s.scopeTeam ? s.scopeTeam.code : s.category}</div>
              <div className="font-mono">
                {s.startTime} › {s.endTime}
              </div>
              <div className="text-ink-soft">{s.location}</div>
              <div>
                <Badge tone={s.status === "Réalisée" ? "green" : s.status === "Annulée" ? "red" : s.status === "En cours" ? "orange" : "blue"}>
                  {s.status}
                </Badge>
              </div>
              <div>
                {late ? (
                  <Badge tone="red">À pointer — {expected} joueurs</Badge>
                ) : done > 0 ? (
                  <span className="font-mono text-green font-semibold">
                    {done} / {expected} pointés
                  </span>
                ) : (
                  <span className="font-mono text-muted-2">—</span>
                )}
              </div>
              <div className="text-right text-[#C9CBC7]">›</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
