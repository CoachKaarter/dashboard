import Link from "next/link";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { getTestTypes, getMeasurementTable } from "@/lib/measurements";
import { FilterChip } from "@/components/ui/FilterChip";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { CATEGORY_FILTERS } from "@/lib/constants";
import { formatDateShort } from "@/lib/format";
import { toQueryString } from "@/lib/query";
import { createTestType } from "./actions";

export default async function MesuresPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>;
}) {
  const sp = await searchParams;
  const team = sp.team ?? "Toutes";

  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const [testTypes, rows] = await Promise.all([getTestTypes(), getMeasurementTable(scope)]);
  const players = rows.filter((p) => team === "Toutes" || p.category === team);

  const gridCols = `minmax(190px,1fr) 72px repeat(${testTypes.length || 1}, 118px)`;

  return (
    <div className="max-w-[1560px] mx-auto animate-fadein">
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        {CATEGORY_FILTERS.map((t) => (
          <FilterChip key={t} href={toQueryString({ team: t === "Toutes" ? undefined : t })} active={team === t}>
            {t}
          </FilterChip>
        ))}
        <span className="flex-1" />
        <div className="font-mono text-[11.5px] text-muted">{players.length} joueurs</div>
        <Link
          href="/mesures/saisie"
          className="h-8 px-3 border border-line rounded-md bg-ink text-white text-xs font-semibold flex items-center hover:bg-[#2A2E36]"
        >
          Saisir des mesures
        </Link>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className="grid gap-3 px-3.5 h-9 items-center bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.07em] uppercase text-muted" style={{ gridTemplateColumns: gridCols }}>
          <div>Joueur</div>
          <div>Catégorie</div>
          {testTypes.map((t) => (
            <div key={t.id} className="text-right">
              {t.name} <span className="text-muted-2 normal-case font-normal">({t.unit})</span>
            </div>
          ))}
        </div>
        {players.map((p) => (
          <Link
            key={p.id}
            href={`/joueurs/${p.id}?tab=mesures`}
            className="grid gap-3 px-3.5 h-11 items-center border-b border-line-soft-2 last:border-b-0 text-[12.5px] hover:bg-bg/60"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar initials={`${p.firstName[0]}${p.lastName[0]}`} size={24} />
              <div className="font-semibold truncate">
                {p.firstName} {p.lastName}
              </div>
            </div>
            <div>
              <TeamChip code={p.category} />
            </div>
            {testTypes.map((t) => {
              const latest = p.latest.get(t.id);
              return (
                <div key={t.id} className="text-right">
                  {latest ? (
                    <>
                      <div className="font-mono font-semibold">{latest.value}</div>
                      <div className="text-[10px] text-muted-2">{formatDateShort(latest.date)}</div>
                    </>
                  ) : (
                    <span className="text-muted-2">—</span>
                  )}
                </div>
              );
            })}
          </Link>
        ))}
        {players.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">Aucun joueur pour ces filtres.</div>}
      </div>

      {user.role === "ADMIN" && (
        <details className="mt-3.5">
          <summary className="cursor-pointer text-[12px] font-semibold text-muted hover:text-ink select-none">
            + Ajouter un type de test
          </summary>
          <form action={createTestType} className="mt-2 flex items-end gap-2 bg-surface border border-line rounded-lg p-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Nom</span>
              <input
                name="name"
                required
                placeholder="ex. Agilité (slalom)"
                className="h-8 border border-line rounded-md px-2 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Unité</span>
              <input
                name="unit"
                required
                placeholder="ex. s"
                className="h-8 w-24 border border-line rounded-md px-2 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
              />
            </label>
            <label className="flex items-center gap-1.5 h-8 text-[12px] text-ink-soft">
              <input type="checkbox" name="lowerIsBetter" className="w-4 h-4" />
              Plus petit = meilleur (chrono)
            </label>
            <button type="submit" className="h-8 px-3 border-none rounded-md bg-ink text-white text-xs font-semibold cursor-pointer hover:bg-[#2A2E36]">
              Ajouter
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
