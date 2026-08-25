import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIdsInCategory, getAccessibleCategories, canManageCategory } from "@/lib/authz";
import { getActiveCategoryGroup } from "@/lib/active-category";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { createTeam } from "./actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

export default async function EquipesPage() {
  const user = await requireUser();
  const activeGroup = await getActiveCategoryGroup(user);
  const isAdmin = user.role === "ADMIN";
  const managedCategories = getAccessibleCategories(user).filter((c) => canManageCategory(user, c));
  const canCreateTeam = isAdmin || managedCategories.length > 0;

  const allTeams = await prisma.team.findMany({ select: { id: true, code: true, category: true } });
  const categoryTeamIds = scopedTeamIdsInCategory(user, allTeams, activeGroup?.categories ?? null);
  const teams = await prisma.team.findMany({
    where: { id: { in: categoryTeamIds } },
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

      {canCreateTeam && (
        <details className="mt-3.5">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-muted hover:text-ink select-none">
            + Nouvelle équipe
          </summary>
          <form action={createTeam} className="mt-2 bg-surface border border-line rounded-lg p-3.5 grid grid-cols-4 gap-2 items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">Code</span>
              <input name="code" required placeholder="U8A" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">Catégorie</span>
              {isAdmin ? (
                <input name="category" required placeholder="U8" className={inputClass} />
              ) : (
                <select name="category" required className={inputClass}>
                  {managedCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted">Format</span>
              <select name="format" defaultValue="Foot à 5" className={inputClass}>
                <option value="Foot à 5">Foot à 5</option>
                <option value="Foot à 8">Foot à 8</option>
                <option value="Foot à 11">Foot à 11</option>
              </select>
            </label>
            <button type="submit" className="h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36]">
              Créer
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
