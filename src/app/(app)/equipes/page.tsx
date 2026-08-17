import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";

export default async function EquipesPage() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);

  const teams = await prisma.team.findMany({
    where: scope === "ALL" ? {} : { id: { in: scope } },
    include: {
      coach: true,
      _count: { select: { players: { where: { archived: false } } } },
    },
    orderBy: { code: "asc" },
  });

  return (
    <div className="max-w-[1000px] mx-auto animate-fadein">
      <div className="text-lg font-bold tracking-[-0.01em] mb-3.5">Équipes</div>
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="grid grid-cols-[100px_minmax(0,1fr)_160px_160px_120px] gap-3 items-center px-3.5 h-[34px] bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted">
          <div>Équipe</div>
          <div>Coach</div>
          <div>Format</div>
          <div>Effectif</div>
          <div />
        </div>
        {teams.map((t) => {
          const actual = t._count.players;
          const target = t.targetSize;
          const gap = target ? actual - target : null;
          return (
            <Link
              key={t.id}
              href={`/equipes/${t.id}`}
              className="grid grid-cols-[100px_minmax(0,1fr)_160px_160px_120px] gap-3 items-center px-3.5 h-12 border-b border-line-soft-2 last:border-b-0 hover:bg-[#FAFAF8]"
            >
              <TeamChip code={t.code} />
              <div className="text-[13px] font-medium text-ink truncate">{t.coach?.name ?? "— non assigné —"}</div>
              <div className="text-[12.5px] text-ink-soft">{t.format}</div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-mono">
                  {actual}
                  {target ? ` / ${target}` : ""}
                </span>
                {gap !== null && gap !== 0 && (
                  <Badge tone={gap < 0 ? "orange" : "blue"}>{gap > 0 ? `+${gap}` : gap}</Badge>
                )}
              </div>
              <div className="text-[11.5px] text-muted text-right">Détails →</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
