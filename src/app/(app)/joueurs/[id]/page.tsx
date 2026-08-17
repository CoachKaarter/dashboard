import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerStatsById } from "@/lib/stats";
import { Avatar } from "@/components/ui/Avatar";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { statutTone, formatDateShort } from "@/lib/format";
import { PLAYER_STATUSES, POSITIONS } from "@/lib/constants";
import { requireUser, canAccessTeam, scopedTeamIds } from "@/lib/authz";
import {
  addPlayerNote,
  changeTeam,
  changeStatus,
  updatePlayer,
  setArchived,
  declareUnavailability,
  endUnavailability,
} from "./actions";

const TABS = [
  { key: "assiduite", label: "Assiduité" },
  { key: "matchs", label: "Matchs" },
  { key: "performance", label: "Performance" },
  { key: "historique", label: "Historique" },
];

const CODE_FULL: Record<string, string> = {
  P: "Présent", R: "Retard", AJ: "Absent justifié", ANJ: "Absent non justifié", B: "Blessé",
};
const CODE_COLOR: Record<string, string> = {
  P: "text-green bg-green-bg", R: "text-orange bg-orange-bg", AJ: "text-neutral-badge bg-neutral-badge-bg",
  ANJ: "text-red bg-red-bg", B: "text-red bg-red-bg",
};

export default async function FichePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : "assiduite";

  const user = await requireUser();
  const [player, stats, allTeams] = await Promise.all([
    prisma.player.findUnique({
      where: { id },
      include: {
        team: true,
        attendances: { include: { session: true }, orderBy: { session: { date: "desc" } }, take: 5 },
        matchStats: { include: { match: true }, orderBy: { match: { date: "desc" } }, take: 4 },
        evaluations: { orderBy: { createdAt: "desc" } },
        history: { include: { fromTeam: true, toTeam: true, decidedBy: true }, orderBy: { date: "desc" } },
        notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
        unavailabilities: { orderBy: { startDate: "desc" } },
      },
    }),
    getPlayerStatsById(id),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
  ]);
  if (!player || !stats) notFound();
  if (!canAccessTeam(user, player.teamId)) notFound();
  const scope = scopedTeamIds(user);
  const reassignableTeams = scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id));

  return (
    <div className="max-w-[1400px] mx-auto animate-fadein">
      <Link href="/joueurs" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Tous les joueurs
      </Link>

      <div className="bg-surface border border-line rounded-lg px-5 py-[18px] flex items-center gap-[18px] flex-wrap">
        <Avatar initials={stats.initials} size={54} />
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="text-[22px] font-bold tracking-[-0.02em]">{stats.name}</div>
            <TeamChip code={stats.teamCode} />
            <Badge tone={statutTone(stats.status)}>{stats.status}</Badge>
            {player.archived && <Badge tone="neutral">Archivé</Badge>}
          </div>
          <div className="text-muted text-[12.5px] mt-1">
            {stats.category} · né en {stats.birthYear} · {stats.position} · pied {stats.foot.toLowerCase()}
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex gap-[22px] flex-wrap">
          <Kpi value={`${Math.round(stats.attendanceRate * 100)}%`} label="Assiduité" tone={stats.attendanceRate < 0.6 ? "text-red" : "text-ink"} />
          <Kpi value={String(stats.minutes)} label="Minutes" />
          <Kpi value={`${stats.matchsJoues}/${stats.matchsDispo}`} label="Matchs joués" />
          <Kpi
            value={`${stats.ecart >= 0 ? "+" : ""}${stats.ecart}'`}
            label="vs équipe"
            tone={stats.ecart < -90 ? "text-red" : stats.ecart < 0 ? "text-orange" : "text-green"}
          />
        </div>
      </div>

      <div className="flex gap-1 my-3.5 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/joueurs/${id}?tab=${t.key}`}
            className={`h-8 px-3.5 text-[12.5px] -mb-px border-b-2 flex items-center ${
              tab === t.key ? "border-ink font-semibold text-ink" : "border-transparent font-medium text-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_330px] gap-4 items-start">
        <div className="flex flex-col gap-3.5">
          {(tab === "assiduite") && (
            <Panel title="Cinq dernières séances" hint={`${stats.presents} présences sur ${stats.seances} séances`}>
              {player.attendances.map((a) => (
                <Row
                  key={a.id}
                  left={formatDateShort(a.session.date)}
                  title={`${a.session.category} — ${a.session.label}`}
                  detail={`${a.session.startTime} › ${a.session.endTime} · ${a.session.location}`}
                  valueNode={<span className={`text-xs font-semibold px-2 py-0.5 rounded ${CODE_COLOR[a.code]}`}>{CODE_FULL[a.code]}</span>}
                />
              ))}
              {player.attendances.length === 0 && <EmptyRow text="Aucune séance pointée pour l'instant." />}
            </Panel>
          )}

          {(tab === "assiduite" || tab === "matchs") && (
            <Panel title="Derniers matchs" hint={`${stats.minutes} minutes cumulées · moyenne équipe ${stats.teamAvgMinutes}`}>
              {player.matchStats.map((m) => (
                <Row
                  key={m.id}
                  left={formatDateShort(m.match.date)}
                  title={`${stats.teamCode} — ${m.match.opponent ?? "Adversaire à définir"}`}
                  detail={`${m.match.isHome ? "Domicile" : "Extérieur"} · ${m.match.competition} · ${m.role}`}
                  valueNode={
                    <span className={`font-mono text-[13px] font-bold ${m.minutes < 30 ? "text-red" : m.minutes < 45 ? "text-orange" : "text-green"}`}>
                      {m.minutes}&apos;
                    </span>
                  }
                />
              ))}
              {player.matchStats.length === 0 && <EmptyRow text="Aucun match joué pour l'instant." />}
            </Panel>
          )}

          {tab === "performance" && (
            <Panel title={`Évaluation — période ${stats.currentEval?.period ?? "—"}`} hint={stats.previousEval ? `comparée à ${stats.previousEval.period}` : "aucune période précédente"}>
              {stats.currentEval ? (
                (["technique", "tactique", "physique", "comportement"] as const).map((k) => {
                  const v = stats.currentEval![k];
                  const prevV = stats.previousEval?.moyenne ?? v;
                  const delta = Math.round((v - prevV) * 10) / 10;
                  return (
                    <Row
                      key={k}
                      left={k[0].toUpperCase() + k.slice(1)}
                      title=""
                      detail={`${delta >= 0 ? "+" : ""}${delta} vs période précédente`}
                      valueNode={<span className={`font-mono text-[13px] font-bold ${delta >= 0 ? "text-green" : "text-orange"}`}>{v.toFixed(1)} / 5</span>}
                    />
                  );
                })
              ) : (
                <EmptyRow text="Ce joueur n'a pas encore été évalué." />
              )}
            </Panel>
          )}

          {tab === "historique" && (
            <Panel title="Parcours dans la catégorie" hint="changements de groupe">
              {player.history.map((h) => (
                <Row
                  key={h.id}
                  left={formatDateShort(h.date)}
                  title={h.fromTeam ? `${h.fromTeam.code} → ${h.toTeam?.code}` : `Entrée en catégorie ${stats.category}`}
                  detail={`Motif : ${h.reason}${h.decidedBy ? " · décidé par " + h.decidedBy.name : ""}`}
                  valueNode={null}
                />
              ))}
              {player.history.length === 0 && <EmptyRow text="Aucun changement de groupe enregistré." />}
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <div className="bg-surface border border-line rounded-lg px-3.5 py-[13px]">
            <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mb-[11px]">Identité</div>
            <div className="flex flex-col gap-2">
              {[
                ["Identifiant", player.id.slice(0, 10)],
                [
                  "Dernière convocation",
                  stats.lastConvocDaysAgo === null
                    ? "aucune"
                    : stats.lastConvocDaysAgo >= 0
                      ? `il y a ${stats.lastConvocDaysAgo} jours`
                      : `dans ${-stats.lastConvocDaysAgo} jours`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2.5 text-[12.5px]">
                  <div className="w-[120px] text-muted">{label}</div>
                  <div className="flex-1 font-medium">{value}</div>
                </div>
              ))}
            </div>

            <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mt-4 mb-[11px]">Modifier</div>
            <form action={updatePlayer.bind(null, id)} className="flex flex-col gap-2.5">
              <EditField label="Année de naissance">
                <input type="number" name="birthYear" defaultValue={stats.birthYear} className={editInputClass} />
              </EditField>
              <EditField label="Poste principal">
                <select name="position" defaultValue={stats.position} className={editInputClass}>
                  <option value="Non renseigné">Non renseigné</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </EditField>
              <EditField label="Poste secondaire">
                <select name="positionAlt" defaultValue={stats.positionAlt} className={editInputClass}>
                  <option value="Non renseigné">Non renseigné</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </EditField>
              <EditField label="Pied fort">
                <select name="foot" defaultValue={stats.foot} className={editInputClass}>
                  <option value="Non renseigné">Non renseigné</option>
                  <option value="Gauche">Gauche</option>
                  <option value="Droit">Droit</option>
                  <option value="Les deux">Les deux</option>
                </select>
              </EditField>
              <EditField label="Arrivée au club">
                <input name="joinedLabel" defaultValue={stats.joinedLabel} className={editInputClass} />
              </EditField>
              <button type="submit" className={editButtonClass}>Enregistrer</button>
            </form>

            <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mt-4 mb-[11px]">Statut</div>
            <form action={changeStatus.bind(null, id)} className="flex gap-2">
              <select name="status" defaultValue={stats.status} className={editInputClass}>
                {PLAYER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button type="submit" className={editButtonClass + " w-auto px-3"}>OK</button>
            </form>

            {reassignableTeams.length > 1 && (
              <>
                <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mt-4 mb-[11px]">Changer de groupe</div>
                <form action={changeTeam.bind(null, id)} className="flex flex-col gap-2">
                  <select name="toTeamId" defaultValue={player.teamId} className={editInputClass}>
                    {reassignableTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.code}</option>
                    ))}
                  </select>
                  <input name="reason" placeholder="Motif (optionnel)" className={editInputClass} />
                  <button type="submit" className={editButtonClass}>Déplacer</button>
                </form>
              </>
            )}

            <form action={setArchived.bind(null, id, !player.archived)} className="mt-4">
              <button type="submit" className="w-full h-8 border border-line rounded-md text-xs font-semibold text-muted hover:border-red hover:text-red">
                {player.archived ? "Réactiver ce joueur" : "Archiver ce joueur"}
              </button>
            </form>
          </div>

          <div className="bg-surface border border-line rounded-lg px-3.5 py-[13px]">
            <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mb-[11px]">Indisponibilités</div>
            <div className="flex flex-col gap-2.5">
              {player.unavailabilities.map((u) => (
                <div key={u.id} className="border-l-2 pl-2.5" style={{ borderColor: u.actualReturn ? "#D2D2CB" : "#C4362C" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold">{u.type}</span>
                    {!u.actualReturn && <Badge tone="red">En cours</Badge>}
                  </div>
                  <div className="text-[11.5px] text-muted mt-px">
                    depuis {formatDateShort(u.startDate)}
                    {u.expectedReturn ? ` · retour prévu ${formatDateShort(u.expectedReturn)}` : ""}
                    {u.actualReturn ? ` · retour effectif ${formatDateShort(u.actualReturn)}` : ""}
                  </div>
                  {u.description && <div className="text-[11.5px] text-ink-soft mt-1">{u.description}</div>}
                  {!u.actualReturn && (
                    <form action={endUnavailability.bind(null, id, u.id)} className="mt-1.5">
                      <button type="submit" className="h-6 px-2 border border-line rounded-md text-[10.5px] font-semibold text-green hover:border-green">
                        Marquer de retour
                      </button>
                    </form>
                  )}
                </div>
              ))}
              {player.unavailabilities.length === 0 && <div className="text-[12.5px] text-muted-2">Aucune indisponibilité enregistrée.</div>}
            </div>
            <form action={declareUnavailability.bind(null, id)} className="mt-3 flex flex-col gap-2">
              <select name="type" defaultValue="Blessure" className={editInputClass}>
                <option value="Blessure">Blessure</option>
                <option value="Maladie">Maladie</option>
                <option value="Absence longue">Absence longue</option>
                <option value="Autre">Autre</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" name="startDate" defaultValue={new Date().toISOString().slice(0, 10)} className={editInputClass} />
                <input type="date" name="expectedReturn" className={editInputClass} />
              </div>
              <input name="description" placeholder="Description (optionnel)" className={editInputClass} />
              <button type="submit" className={editButtonClass}>Déclarer une indisponibilité</button>
            </form>
          </div>

          <div className="bg-surface border border-line rounded-lg px-3.5 py-[13px]">
            <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mb-[11px]">Notes staff</div>
            <div className="flex flex-col gap-2.5">
              {player.notes.map((n) => (
                <div key={n.id} className="border-l-2 border-line pl-2.5">
                  <div className="text-[12.5px] text-ink-soft leading-relaxed">{n.text}</div>
                  <div className="font-mono text-[10.5px] text-muted-2 mt-[3px]">
                    {n.author.name.split(" ")[0]} · {formatDateShort(n.createdAt)}/{n.createdAt.getFullYear()}
                  </div>
                </div>
              ))}
              {player.notes.length === 0 && <div className="text-[12.5px] text-muted-2">Aucune note pour l&apos;instant.</div>}
            </div>
            <form action={addPlayerNote.bind(null, id)} className="mt-3 flex flex-col gap-2">
              <textarea
                name="text"
                required
                rows={2}
                placeholder="Ajouter une note interne…"
                className="w-full border border-line rounded-md px-2.5 py-2 text-[12.5px] outline-none focus:border-blue resize-none"
              />
              <button
                type="submit"
                className="w-full h-[30px] border border-dashed border-line rounded-md bg-[#FCFCFB] text-xs text-muted cursor-pointer hover:border-ink hover:text-ink"
              >
                + Ajouter une note
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

const editInputClass =
  "h-8 border border-line rounded-md px-2 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";
const editButtonClass =
  "h-8 border border-line rounded-md bg-[#FCFCFB] text-xs font-semibold text-ink-soft hover:border-ink hover:text-ink";

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] text-muted">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ value, label, tone = "text-ink" }: { value: string; label: string; tone?: string }) {
  return (
    <div className="text-right">
      <div className={`font-mono text-[17px] font-bold tracking-[-0.02em] ${tone}`}>{value}</div>
      <div className="text-[10.5px] text-muted uppercase tracking-[0.07em] mt-px">{label}</div>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border border-line rounded-lg overflow-hidden">
      <div className="px-3.5 py-[11px] border-b border-line-soft flex items-center gap-2">
        <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">{title}</span>
        <span className="flex-1" />
        <span className="text-[11.5px] text-muted-2">{hint}</span>
      </div>
      {children}
    </section>
  );
}

function Row({ left, title, detail, valueNode }: { left: string; title: string; detail: string; valueNode: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)_auto] gap-3 items-center px-3.5 py-[9px] border-b border-line-soft-2 last:border-b-0 text-[12.5px]">
      <div className="font-mono text-[11.5px] text-muted">{left}</div>
      <div>
        {title && <div className="font-semibold">{title}</div>}
        <div className="text-muted text-xs mt-px">{detail}</div>
      </div>
      <div>{valueNode}</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div className="px-3.5 py-6 text-center text-muted-2 text-[12.5px]">{text}</div>;
}
