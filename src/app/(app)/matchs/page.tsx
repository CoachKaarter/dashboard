import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { formatDateShort } from "@/lib/format";
import { requireUser, scopedTeamIdsInCategory } from "@/lib/authz";
import { getActiveCategoryGroup } from "@/lib/active-category";
import { computeMatchResult } from "@/lib/match-phase";

const GRID = "grid-cols-[70px_76px_minmax(190px,1fr)_110px_140px_62px_68px_130px_24px]";

export default async function MatchsPage() {
  const user = await requireUser();
  const activeGroup = await getActiveCategoryGroup(user);
  const allTeams = await prisma.team.findMany({ select: { id: true, code: true, category: true } });
  const categoryTeamIds = scopedTeamIdsInCategory(user, allTeams, activeGroup?.categories ?? null);
  const matches = await prisma.match.findMany({
    where: { teamId: { in: categoryTeamIds } },
    include: { team: true, convocations: true, _count: { select: { stats: true, plateauResults: true } } },
    orderBy: { date: "asc" },
  });

  return (
    <div className="max-w-[1620px] mx-auto animate-fadein">
      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className={`grid ${GRID} gap-3 px-3.5 h-[34px] items-center bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted`}>
          <div>Date</div>
          <div>Équipe</div>
          <div>Adversaire</div>
          <div>Compétition</div>
          <div>Lieu</div>
          <div>Heure</div>
          <div>Score</div>
          <div>Convocation</div>
          <div></div>
        </div>
        {matches.map((m) => {
          const played = m.status === "Joué";
          const cancelled = m.status === "Annulé";
          const isPlateau = m.competition === "Plateau";
          return (
            <Link
              key={m.id}
              href={`/matchs/${m.id}`}
              className={`grid ${GRID} gap-3 px-3.5 h-[42px] items-center border-b border-line-soft-2 last:border-b-0 text-[12.5px] hover:bg-bg/60`}
            >
              <div className="font-mono font-bold">{formatDateShort(m.date)}</div>
              <div>
                <TeamChip code={m.team.code} />
              </div>
              {isPlateau ? (
                <div className="truncate text-ink-soft">Plusieurs équipes</div>
              ) : (
                <div className={`truncate ${m.opponent ? "font-semibold" : "text-red font-semibold"}`}>{m.opponent ?? "Adversaire à définir"}</div>
              )}
              <div className="text-ink-soft">{m.competition}</div>
              <div className={m.location ? "text-ink-soft" : "text-red"}>{m.location ?? "—"}</div>
              <div className={`font-mono ${m.time ? "" : "text-red"}`}>{m.time ?? "—"}</div>
              {isPlateau ? (
                <div className="font-mono font-bold text-muted-2">
                  {m._count.plateauResults} rencontre{m._count.plateauResults > 1 ? "s" : ""}
                </div>
              ) : (
                <div
                  className={`font-mono font-bold ${
                    played
                      ? computeMatchResult(m.scoreFor!, m.scoreAgainst!) === "GAGNE"
                        ? "text-green"
                        : computeMatchResult(m.scoreFor!, m.scoreAgainst!) === "NUL"
                          ? "text-muted"
                          : "text-red"
                      : "text-muted-2"
                  }`}
                >
                  {played ? `${m.scoreFor} – ${m.scoreAgainst}` : "—"}
                </div>
              )}
              <div>
                {cancelled ? (
                  <Badge tone="red">Annulé</Badge>
                ) : played ? (
                  <Badge tone={m._count.stats > 0 ? "green" : "neutral"}>{m._count.stats > 0 ? "Feuille saisie" : "Feuille à saisir"}</Badge>
                ) : m.convocations.length >= m.needed ? (
                  <Badge tone="green">Complète</Badge>
                ) : (
                  <Badge tone={m.convocations.length === 0 ? "red" : "orange"}>
                    {m.convocations.length} / {m.needed}
                  </Badge>
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
