import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, scopedTeamIds, getAccessibleCategories } from "@/lib/authz";
import { getTestTypes } from "@/lib/measurements";
import { Avatar } from "@/components/ui/Avatar";
import { TeamChip } from "@/components/ui/TeamChip";
import { NumField } from "@/components/ui/NumField";
import { FilterChip } from "@/components/ui/FilterChip";
import { QuerySelect } from "@/components/ui/QuerySelect";
import { QueryDateInput } from "@/components/ui/QueryDateInput";
import { CATEGORY_FILTERS } from "@/lib/constants";
import { toQueryString } from "@/lib/query";
import { recordMeasurement } from "../actions";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function SaisieMesuresPage({
  searchParams,
}: {
  searchParams: Promise<{ test?: string; date?: string; team?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const testTypes = await getTestTypes();

  if (testTypes.length === 0) {
    return (
      <div className="max-w-[720px] mx-auto animate-fadein">
        <Link href="/mesures" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
          ← Tableau des mesures
        </Link>
        <div className="bg-surface border border-line rounded-lg p-5 text-[13px] text-muted">
          Aucun type de test disponible pour l&apos;instant. Ajoutez-en un depuis{" "}
          <Link href="/mesures" className="text-blue font-semibold hover:underline">
            l&apos;écran Mesures
          </Link>
          .
        </div>
      </div>
    );
  }

  const testTypeId = testTypes.some((t) => t.id === sp.test) ? sp.test! : testTypes[0].id;
  const testType = testTypes.find((t) => t.id === testTypeId)!;
  const dateIso = sp.date && !Number.isNaN(new Date(sp.date).getTime()) ? sp.date : todayIso();
  const team = sp.team ?? "Toutes";

  const accessibleCategories = getAccessibleCategories(user);
  const playersAll = await prisma.player.findMany({
    where: { archived: false, status: "Actif", ...(scope === "ALL" ? {} : { category: { in: accessibleCategories } }) },
    include: { team: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  const players = playersAll.filter((p) => team === "Toutes" || p.category === team);

  const date = new Date(dateIso);
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const existing = await prisma.physicalTestResult.findMany({
    where: { testTypeId, date: dayStart, playerId: { in: players.map((p) => p.id) } },
  });
  const existingByPlayer = new Map(existing.map((r) => [r.playerId, r.value]));

  return (
    <div className="max-w-[720px] mx-auto animate-fadein">
      <Link href="/mesures" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Tableau des mesures
      </Link>

      <div className="bg-surface border border-line rounded-lg px-3.5 py-3 mb-3.5 flex items-center gap-3 flex-wrap">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Test</span>
          <QuerySelect paramKey="test" options={testTypes.map((t) => ({ value: t.id, label: `${t.name} (${t.unit})` }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Date</span>
          <QueryDateInput paramKey="date" defaultValue={todayIso()} />
        </label>
        <div className="flex-1" />
        <div className="flex gap-1.5">
          {CATEGORY_FILTERS.map((t) => (
            <FilterChip key={t} href={toQueryString({ test: testTypeId, date: dateIso, team: t === "Toutes" ? undefined : t })} active={team === t}>
              {t}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_72px_120px] gap-3 items-center px-3.5 h-9 bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.07em] uppercase text-muted">
          <div>Joueur</div>
          <div>Catégorie</div>
          <div className="text-right">{testType.name} ({testType.unit})</div>
        </div>
        {players.map((p) => (
          <form
            key={p.id}
            action={recordMeasurement.bind(null, p.id, testTypeId, dayStart.toISOString())}
            className="grid grid-cols-[minmax(0,1fr)_72px_120px] gap-3 items-center px-3.5 h-11 border-b border-line-soft-2 last:border-b-0 text-[12.5px]"
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
            <NumField name="value" defaultValue={existingByPlayer.get(p.id) ?? ""} step="0.1" />
          </form>
        ))}
        {players.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">Aucun joueur pour ces filtres.</div>}
      </div>
      <div className="text-[11.5px] text-muted-2 mt-2">Chaque valeur est enregistrée automatiquement dès que vous quittez le champ. Laisser un champ vide efface la mesure du jour pour ce joueur.</div>
    </div>
  );
}
