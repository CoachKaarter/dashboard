import { prisma } from "@/lib/prisma";
import { getAllPlayerStats } from "@/lib/stats";
import { getSettings } from "@/lib/settings";
import { FilterChip } from "@/components/ui/FilterChip";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { NumField } from "@/components/ui/NumField";
import { EVAL_PERIODS, CATEGORY_FILTERS } from "@/lib/constants";
import { toQueryString } from "@/lib/query";
import { requireUser, scopedTeamIds, getAccessibleCategories } from "@/lib/authz";
import { upsertEvaluation } from "./actions";

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; team?: string }>;
}) {
  const sp = await searchParams;
  const period = EVAL_PERIODS.includes(sp.period ?? "") ? sp.period! : EVAL_PERIODS[0];
  const team = sp.team ?? "Toutes";

  const [allStats, settings, periodEvals] = await Promise.all([
    getAllPlayerStats(),
    getSettings(),
    prisma.evaluationScore.findMany({ where: { period } }),
  ]);
  const evalByPlayer = new Map(periodEvals.map((e) => [e.playerId, e]));

  const user = await requireUser();
  const scope = scopedTeamIds(user);
  // A player with no fixed team (Player.teamId null) is still in scope
  // whenever their category is.
  const accessibleCategories = new Set(getAccessibleCategories(user));
  const players = allStats.filter(
    (p) =>
      (scope === "ALL" || (p.teamId !== null && scope.includes(p.teamId)) || accessibleCategories.has(p.category)) &&
      (team === "Toutes" || p.category === team)
  );

  return (
    <div className="max-w-[1620px] mx-auto animate-fadein">
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        {EVAL_PERIODS.map((p) => (
          <FilterChip key={p} href={toQueryString({ period: p === EVAL_PERIODS[0] ? undefined : p, team: sp.team })} active={period === p}>
            {p}
          </FilterChip>
        ))}
        <div className="w-px h-[22px] bg-line mx-1" />
        {CATEGORY_FILTERS.map((t) => (
          <FilterChip key={t} href={toQueryString({ period: sp.period, team: t === "Toutes" ? undefined : t })} active={team === t}>
            {t}
          </FilterChip>
        ))}
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className="grid grid-cols-[minmax(190px,1fr)_72px_repeat(4,104px)_74px_78px_156px] gap-3 items-center px-3.5 h-9 bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.07em] uppercase text-muted">
          <div>Joueur</div>
          <div>Équipe</div>
          <div>Technique</div>
          <div>Tactique</div>
          <div>Physique</div>
          <div>Comportement</div>
          <div className="text-right">Moyenne</div>
          <div className="text-right">Évolution</div>
          <div className="text-right">Suivi</div>
        </div>
        {players.map((p) => {
          const ev = evalByPlayer.get(p.id);
          const moyenne = ev ? Math.round(((ev.technique + ev.tactique + ev.physique + ev.comportement) / 4) * 10) / 10 : null;
          const prevMoyenne = p.previousEval?.moyenne ?? (p.currentEval && p.currentEval.period !== period ? p.currentEval.moyenne : null);
          const delta = moyenne !== null && prevMoyenne !== null ? Math.round((moyenne - prevMoyenne) * 10) / 10 : null;
          const stale = p.lastEvalDaysAgo === null || p.lastEvalDaysAgo > settings.delaiEval;

          return (
            <form
              key={p.id}
              action={upsertEvaluation.bind(null, p.id, period)}
              className="grid grid-cols-[minmax(190px,1fr)_72px_repeat(4,104px)_74px_78px_156px] gap-3 items-center px-3.5 h-[52px] border-b border-line-soft-2 last:border-b-0 text-[12.5px]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar initials={p.initials} size={24} />
                <div className="font-semibold truncate">{p.name}</div>
              </div>
              <div>
                <TeamChip code={p.category} />
              </div>
              {(["technique", "tactique", "physique", "comportement"] as const).map((k) => (
                <NumField key={k} name={k} defaultValue={ev ? ev[k] : ""} step="0.1" />
              ))}
              <div className="text-right font-mono font-bold">{moyenne !== null ? moyenne.toFixed(1) : "—"}</div>
              <div
                className="text-right font-mono text-xs font-bold"
                style={{ color: delta === null ? "#9A9DA3" : delta >= 0 ? "#3F8F5B" : "#C97A17" }}
              >
                {delta === null ? "—" : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}`}
              </div>
              <div className="text-right">
                <span
                  className="text-[11px] font-semibold px-[7px] py-0.5 rounded"
                  style={{ color: stale ? "#C97A17" : "#3F8F5B", background: stale ? "#FDF3E4" : "#ECF5EF" }}
                >
                  {stale ? (p.lastEvalDaysAgo === null ? "Jamais évalué" : `Non évalué depuis ${p.lastEvalDaysAgo} j`) : "À jour"}
                </span>
              </div>
            </form>
          );
        })}
        {players.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">Aucun joueur pour ces filtres.</div>}
      </div>
    </div>
  );
}
