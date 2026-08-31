import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessTeam, canManageCategory } from "@/lib/authz";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { FilterChip } from "@/components/ui/FilterChip";
import { POSITIONS } from "@/lib/constants";
import { formatDateFull } from "@/lib/format";
import { toQueryString } from "@/lib/query";
import { computeTeamStats, computeForm, flattenPlayedMatches } from "@/lib/team-stats";
import { COMPETITION_TYPES } from "@/lib/match-validation";
import { TRANSPORT_MODES, TRANSPORT_MODE_LABELS } from "@/lib/equipment";
import { updateTeamTarget, updateTeamFormat, updateTeamCoach, updateTeamLevel, updateTeamDefaults } from "../actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

const PERIODS = [
  { key: "saison", label: "Saison" },
  { key: "mois", label: "Ce mois-ci" },
  { key: "5", label: "5 derniers matchs" },
  { key: "10", label: "10 derniers matchs" },
];

const LIEUX = [
  { key: "domicile", label: "Domicile" },
  { key: "exterieur", label: "Extérieur" },
];

const FORM_TONE: Record<string, string> = { GAGNE: "bg-green text-white", NUL: "bg-neutral-badge text-ink-soft", PERDU: "bg-red text-white" };
const FORM_LETTER: Record<string, string> = { GAGNE: "V", NUL: "N", PERDU: "D" };

export default async function EquipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periode?: string; competition?: string; lieu?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  if (!canAccessTeam(user, id)) notFound();

  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      coach: true,
      players: { where: { archived: false }, orderBy: [{ position: "asc" }, { lastName: "asc" }] },
    },
  });
  if (!team) notFound();

  const periode = PERIODS.some((p) => p.key === sp.periode) ? sp.periode! : "saison";
  const competitionFilter = COMPETITION_TYPES.includes(sp.competition as (typeof COMPETITION_TYPES)[number]) ? sp.competition : undefined;
  const lieuFilter = LIEUX.some((l) => l.key === sp.lieu) ? sp.lieu : undefined;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const playedMatches = await prisma.match.findMany({
    where: {
      teamId: id,
      status: "Joué",
      ...(competitionFilter ? { competition: competitionFilter } : {}),
      ...(lieuFilter ? { isHome: lieuFilter === "domicile" } : {}),
      ...(periode === "mois" ? { date: { gte: monthStart } } : {}),
    },
    orderBy: { date: "asc" },
    select: {
      competition: true,
      scoreFor: true,
      scoreAgainst: true,
      date: true,
      plateauResults: { select: { scoreFor: true, scoreAgainst: true }, orderBy: { order: "asc" } },
    },
  });

  const playedResults = flattenPlayedMatches(playedMatches);
  const filteredMatches = periode === "5" ? playedResults.slice(-5) : periode === "10" ? playedResults.slice(-10) : playedResults;
  const stats = computeTeamStats(filteredMatches);
  const form = computeForm(filteredMatches, 5);

  const isAdmin = user.role === "ADMIN";
  const canManageDefaults = isAdmin || canManageCategory(user, team.category);
  const coaches = isAdmin ? await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [];

  const movements = await prisma.teamHistoryEntry.findMany({
    where: { OR: [{ fromTeamId: id }, { toTeamId: id }] },
    include: { player: true, fromTeam: true, toTeam: true, decidedBy: true },
    orderBy: { date: "desc" },
    take: 20,
  });

  const byPosition = new Map<string, typeof team.players>();
  for (const pos of [...POSITIONS, "Non renseigné"]) byPosition.set(pos, []);
  for (const p of team.players) {
    if (!byPosition.has(p.position)) byPosition.set(p.position, []);
    byPosition.get(p.position)!.push(p);
  }

  const actual = team.players.length;
  const target = team.targetSize;

  return (
    <div className="max-w-[1100px] mx-auto animate-fadein">
      <Link href="/equipes" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Toutes les équipes
      </Link>

      <div className="bg-surface border border-line rounded-lg px-[18px] py-4 flex items-center gap-3 flex-wrap">
        <TeamChip code={team.code} />
        <div className="text-xl font-bold tracking-[-0.02em]">{team.category}</div>
        <span className="text-[13px] text-muted">
          {actual} joueur{actual > 1 ? "s" : ""}
          {target ? ` sur un effectif cible de ${target}` : ""}
        </span>
        <span className="flex-1" />
        <Link href="/joueurs/nouveau" className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink hover:text-ink flex items-center">
          + Ajouter un joueur
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3 mt-3.5">
        <form action={updateTeamTarget.bind(null, id)} className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Effectif cible</span>
          <div className="flex gap-2">
            <input type="number" name="targetSize" min={1} max={30} defaultValue={target ?? ""} className={`${inputClass} flex-1`} />
            <button type="submit" className="h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36]">OK</button>
          </div>
        </form>
        <form action={updateTeamLevel.bind(null, id)} className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Niveau (ex. ELITE, D1…)</span>
          <div className="flex gap-2">
            <input name="level" defaultValue={team.level ?? ""} placeholder="D1" className={`${inputClass} flex-1`} />
            <button type="submit" className="h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36]">OK</button>
          </div>
        </form>
        <form action={updateTeamFormat.bind(null, id)} className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2">
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Format</span>
          <div className="flex gap-2">
            <select name="format" defaultValue={team.format} className={`${inputClass} flex-1`}>
              <option value="Foot à 5">Foot à 5</option>
              <option value="Foot à 8">Foot à 8</option>
              <option value="Foot à 11">Foot à 11</option>
            </select>
            <button type="submit" className="h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36]">OK</button>
          </div>
        </form>
        {isAdmin ? (
          <form action={updateTeamCoach.bind(null, id)} className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2">
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Coach / responsable</span>
            <div className="flex gap-2">
              <select name="coachId" defaultValue={team.coachId ?? ""} className={`${inputClass} flex-1`}>
                <option value="">— non assigné —</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button type="submit" className="h-9 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36]">OK</button>
            </div>
          </form>
        ) : (
          <div className="bg-surface border border-line rounded-lg p-3.5 flex flex-col gap-2">
            <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-muted">Coach / responsable</span>
            <span className="text-[13px] font-medium mt-1.5">{team.coach?.name ?? "— non assigné —"}</span>
          </div>
        )}
      </div>

      <details className="bg-surface border border-line rounded-lg mt-3.5">
        <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-semibold text-muted hover:text-ink select-none">
          Habitudes de l&apos;équipe pour les matchs (RDV, transport, tenue…)
        </summary>
        <div className="px-3.5 pb-3.5">
          <div className="text-[11.5px] text-muted-2 mb-2.5 leading-relaxed">
            Préremplit automatiquement les infos parents de chaque nouveau match de cette équipe (toujours modifiable match par match). Laisser vide pour
            utiliser le modèle de match ou les réglages généraux du club.
          </div>
          {canManageDefaults ? (
            <form action={updateTeamDefaults.bind(null, id)} className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-muted">RDV avant le coup d&apos;envoi (minutes)</span>
                <input type="number" name="meetTimeDeltaMinutes" min={0} max={240} defaultValue={team.meetTimeDeltaMinutes ?? ""} placeholder="45" className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-muted">Transport habituel</span>
                <select name="defaultTransportMode" defaultValue={team.defaultTransportMode ?? ""} className={inputClass}>
                  <option value="">— non précisé —</option>
                  {TRANSPORT_MODES.map((m) => (
                    <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-muted">Durée habituelle du match (minutes)</span>
                <input type="number" name="defaultDurationMinutes" min={0} max={240} defaultValue={team.defaultDurationMinutes ?? ""} placeholder="60" className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-muted">Délai de retour après la fin (minutes)</span>
                <input type="number" name="defaultReturnDelayMinutes" min={0} max={240} defaultValue={team.defaultReturnDelayMinutes ?? ""} placeholder="15" className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-muted">Tenue demandée</span>
                <input name="defaultDressCode" defaultValue={team.defaultDressCode ?? ""} placeholder="Tenue du club" className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-muted">Matériel personnel à prévoir</span>
                <input name="defaultPersonalGear" defaultValue={team.defaultPersonalGear ?? ""} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-muted">Repas / collation à prévoir</span>
                <input name="defaultMealInfo" defaultValue={team.defaultMealInfo ?? ""} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] text-muted">Consignes habituelles pour les parents</span>
                <input name="defaultParentInstructions" defaultValue={team.defaultParentInstructions ?? ""} className={inputClass} />
              </label>
              <button type="submit" className="col-span-2 h-9 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36] self-start px-4">
                Enregistrer les habitudes de l&apos;équipe
              </button>
            </form>
          ) : (
            <div className="text-[11.5px] text-muted-2">
              Réservé au Responsable de la catégorie {team.category} (ou à l&apos;administrateur).
            </div>
          )}
        </div>
      </details>

      <div className="text-[13px] font-bold mt-5 mb-2">Statistiques & tendances</div>
      <div className="bg-surface border border-line rounded-lg p-3.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          {PERIODS.map((p) => (
            <FilterChip
              key={p.key}
              href={toQueryString({ periode: p.key === "saison" ? undefined : p.key, competition: competitionFilter, lieu: lieuFilter })}
              active={periode === p.key}
            >
              {p.label}
            </FilterChip>
          ))}
          <div className="w-px h-[22px] bg-line mx-1" />
          <FilterChip href={toQueryString({ periode, competition: undefined, lieu: lieuFilter })} active={!competitionFilter}>
            Toutes compétitions
          </FilterChip>
          {COMPETITION_TYPES.map((c) => (
            <FilterChip key={c} href={toQueryString({ periode, competition: c, lieu: lieuFilter })} active={competitionFilter === c}>
              {c}
            </FilterChip>
          ))}
          <div className="w-px h-[22px] bg-line mx-1" />
          <FilterChip href={toQueryString({ periode, competition: competitionFilter, lieu: undefined })} active={!lieuFilter}>
            Domicile + extérieur
          </FilterChip>
          {LIEUX.map((l) => (
            <FilterChip key={l.key} href={toQueryString({ periode, competition: competitionFilter, lieu: l.key })} active={lieuFilter === l.key}>
              {l.label}
            </FilterChip>
          ))}
        </div>

        {stats.played === 0 ? (
          <div className="text-[13px] text-muted mt-3.5">Aucun match joué sur cette période.</div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 flex-wrap mt-3.5 pt-3.5 border-t border-line-soft">
              {[
                ["Joués", String(stats.played)],
                ["Victoires", String(stats.wins)],
                ["Nuls", String(stats.draws)],
                ["Défaites", String(stats.losses)],
                ["Buts marqués", String(stats.goalsFor)],
                ["Buts encaissés", String(stats.goalsAgainst)],
                ["Diff.", stats.goalDiff > 0 ? `+${stats.goalDiff}` : String(stats.goalDiff)],
                ["% victoires", `${stats.winPct}%`],
                ["Moy. marqués", String(stats.avgGoalsFor)],
                ["Moy. encaissés", String(stats.avgGoalsAgainst)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-1.5 pr-3.5 border-r border-line-soft last:border-r-0">
                  <span className="font-mono text-[15px] font-bold">{value}</span>
                  <span className="text-[11px] text-muted">{label}</span>
                </div>
              ))}
            </div>
            {form.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-line-soft">
                <span className="text-[11px] text-muted mr-1">Forme (5 derniers) :</span>
                {form.map((r, i) => (
                  <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${FORM_TONE[r]}`}>
                    {FORM_LETTER[r]}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="text-[13px] font-bold mt-5 mb-2">Tableau de profondeur par poste</div>
      <div className="grid grid-cols-3 gap-3">
        {[...byPosition.entries()].filter(([, players]) => players.length > 0).map(([pos, players]) => (
          <div key={pos} className="bg-surface border border-line rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-line-soft bg-[#FAFAF8] flex items-center gap-2">
              <span className="text-[12px] font-bold text-ink-soft">{pos}</span>
              <Badge tone="neutral">{players.length}</Badge>
            </div>
            {players.map((p) => (
              <Link key={p.id} href={`/joueurs/${p.id}`} className="flex items-center gap-2 px-3 py-1.5 border-b border-line-soft-2 last:border-b-0 hover:bg-[#FAFAF8]">
                <Avatar initials={`${p.firstName[0]}${p.lastName[0]}`} size={22} />
                <span className="text-[12.5px] font-medium truncate">{p.firstName} {p.lastName}</span>
                {p.status !== "Actif" && <Badge tone="orange" className="ml-auto">{p.status}</Badge>}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="text-[13px] font-bold mt-5 mb-2">Historique des mouvements</div>
      <div className="bg-surface border border-line rounded-lg overflow-hidden">
        {movements.length === 0 ? (
          <div className="px-3.5 py-4 text-[12.5px] text-muted">Aucun mouvement enregistré pour cette équipe.</div>
        ) : (
          movements.map((m) => (
            <div key={m.id} className="flex items-center gap-2.5 px-3.5 py-2 border-b border-line-soft-2 last:border-b-0 text-[12.5px]">
              <span className="text-muted-2 w-20 shrink-0">{formatDateFull(m.date)}</span>
              <Link href={`/joueurs/${m.playerId}`} className="font-semibold hover:underline">{m.player.firstName} {m.player.lastName}</Link>
              <span className="text-ink-soft">
                {m.fromTeam ? `${m.fromTeam.code} → ` : ""}{m.toTeam ? m.toTeam.code : "sorti"}
              </span>
              <span className="text-muted flex-1 truncate">{m.reason}</span>
              {m.decidedBy && <span className="text-muted-2 text-[11px]">par {m.decidedBy.name}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
