import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { formatDateShort } from "@/lib/format";
import { requireUser, teamScopeWhere } from "@/lib/authz";

const GRID = "grid-cols-[70px_76px_minmax(190px,1fr)_110px_140px_62px_68px_130px_24px]";

export default async function MatchsPage() {
  const user = await requireUser();
  const matches = await prisma.match.findMany({
    where: teamScopeWhere(user),
    include: { team: true, convocations: true, _count: { select: { stats: true } } },
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
              <div className={`truncate ${m.opponent ? "font-semibold" : "text-red font-semibold"}`}>{m.opponent ?? "Adversaire à définir"}</div>
              <div className="text-ink-soft">{m.competition}</div>
              <div className={m.location ? "text-ink-soft" : "text-red"}>{m.location ?? "—"}</div>
              <div className={`font-mono ${m.time ? "" : "text-red"}`}>{m.time ?? "—"}</div>
              <div
                className={`font-mono font-bold ${
                  played ? (m.scoreFor! > m.scoreAgainst! ? "text-green" : m.scoreFor === m.scoreAgainst ? "text-muted" : "text-red") : "text-muted-2"
                }`}
              >
                {played ? `${m.scoreFor} – ${m.scoreAgainst}` : "—"}
              </div>
              <div>
                {played ? (
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
