import Link from "next/link";
import { getAllPlayerStats } from "@/lib/stats";
import { FilterChip } from "@/components/ui/FilterChip";
import { QuerySelect } from "@/components/ui/QuerySelect";
import { TextFilter } from "@/components/ui/TextFilter";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { TEAM_FILTERS, POSITIONS, PLAYER_STATUSES } from "@/lib/constants";
import { codeTone, statutTone } from "@/lib/format";
import { toQueryString } from "@/lib/query";

const GRID = "grid-cols-[28px_minmax(180px,1.5fr)_62px_84px_120px_88px_104px_122px_76px_30px]";

export default async function JoueursPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string; pos?: string; statut?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const team = sp.team ?? "Toutes";
  const pos = sp.pos ?? "Tous";
  const statut = sp.statut ?? "Tous";
  const q = (sp.q ?? "").trim().toLowerCase();

  const all = await getAllPlayerStats();
  const players = all.filter(
    (p) =>
      (team === "Toutes" || p.teamCode === team || p.category === team) &&
      (pos === "Tous" || p.position === pos) &&
      (statut === "Tous" || p.status === statut) &&
      (!q || p.name.toLowerCase().includes(q) || p.teamCode.toLowerCase().includes(q))
  );

  return (
    <div className="max-w-[1560px] mx-auto animate-fadein">
      <div className="flex items-center gap-2.5 mb-3.5 flex-wrap">
        {TEAM_FILTERS.map((t) => (
          <FilterChip key={t} href={toQueryString({ team: t === "Toutes" ? undefined : t, pos: sp.pos, statut: sp.statut, q: sp.q })} active={team === t}>
            {t}
          </FilterChip>
        ))}
        <span className="flex-1" />
        <TextFilter paramKey="q" placeholder="Rechercher…" />
        <QuerySelect paramKey="pos" options={[{ value: "Tous", label: "Tous les postes" }, ...POSITIONS.map((p) => ({ value: p, label: p }))]} />
        <QuerySelect paramKey="statut" options={[{ value: "Tous", label: "Tous les statuts" }, ...PLAYER_STATUSES.map((s) => ({ value: s, label: s }))]} />
        <div className="font-mono text-[11.5px] text-muted">{players.length} joueurs</div>
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-auto">
        <div className={`grid ${GRID} gap-0 px-3.5 h-[34px] items-center bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted`}>
          <div></div>
          <div>Joueur</div>
          <div>Année</div>
          <div>Équipe</div>
          <div>Poste</div>
          <div>Statut</div>
          <div>Assiduité</div>
          <div>5 dernières</div>
          <div className="text-right">Minutes</div>
          <div></div>
        </div>
        {players.map((p) => (
          <Link
            key={p.id}
            href={`/joueurs/${p.id}`}
            className={`grid ${GRID} gap-0 px-3.5 h-[42px] items-center border-b border-line-soft-2 last:border-b-0 text-[12.5px] hover:bg-bg/60`}
          >
            <div
              className={`w-[5px] h-[5px] rounded-full ${
                p.status !== "Actif" ? "bg-red" : p.attendanceRate < 0.6 || p.ecart < -90 ? "bg-orange" : "bg-transparent"
              }`}
            />
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar initials={p.initials} size={26} />
              <div className="min-w-0 font-semibold truncate">{p.name}</div>
            </div>
            <div className="font-mono text-muted">{p.birthYear}</div>
            <div>
              <TeamChip code={p.teamCode} />
            </div>
            <div className="text-ink-soft truncate">{p.position}</div>
            <div>
              <Badge tone={statutTone(p.status)}>{p.status}</Badge>
            </div>
            <div className="flex items-center gap-[7px]">
              <div className="w-[46px] h-1 bg-line-soft rounded-full overflow-hidden">
                <div
                  className={`h-full ${p.attendanceRate < 0.6 ? "bg-red" : p.attendanceRate < 0.8 ? "bg-orange" : "bg-green"}`}
                  style={{ width: `${Math.round(p.attendanceRate * 100)}%` }}
                />
              </div>
              <span className={`font-mono text-[11px] ${p.attendanceRate < 0.6 ? "text-red" : "text-muted"}`}>
                {Math.round(p.attendanceRate * 100)}%
              </span>
            </div>
            <div className="flex gap-[3px]">
              {p.last5.map((d, i) => (
                <span
                  key={i}
                  title={d.code}
                  className={`inline-flex items-center justify-center min-w-[22px] h-[18px] px-[3px] rounded font-mono text-[9.5px] font-bold ${
                    { green: "text-green bg-green-bg", orange: "text-orange bg-orange-bg", neutral: "text-neutral-badge bg-neutral-badge-bg", red: "text-red bg-red-bg" }[
                      codeTone(d.code)
                    ]
                  }`}
                >
                  {d.code}
                </span>
              ))}
              {p.last5.length === 0 && <span className="text-muted-2 text-xs">—</span>}
            </div>
            <div className="text-right font-mono font-semibold">{p.minutes}</div>
            <div className="text-right text-[#C9CBC7]">›</div>
          </Link>
        ))}
        {players.length === 0 && <div className="px-4 py-10 text-center text-muted text-[13px]">Aucun joueur ne correspond à ces filtres.</div>}
      </div>
    </div>
  );
}
