import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerStatsById } from "@/lib/stats";
import { Avatar } from "@/components/ui/Avatar";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { statutTone, formatDateShort } from "@/lib/format";
import { PLAYER_STATUSES, POSITIONS, EVAL_PERIODS, INTERVIEW_TYPE_LABELS, OBJECTIVE_CATEGORY_LABELS, OBJECTIVE_STATUS_LABELS } from "@/lib/constants";
import { ProgressChart } from "@/components/ui/ProgressChart";
import { ParentAccountPanel } from "@/components/ParentAccountPanel";
import { updateObjectives } from "../../evaluations/actions";
import { requireUser, canAccessTeam, scopedTeamIds } from "@/lib/authz";
import { getInterviewPrep } from "@/lib/interview-prep";
import { computeEvaluationDelta } from "@/lib/evaluation";
import { computeDistribution } from "@/lib/player-history";
import { getPlayerMeasurementHistory, getTestTypes, computeMeasurementTrend } from "@/lib/measurements";
import {
  addPlayerNote,
  changeTeam,
  changeStatus,
  updatePlayer,
  updateParentContact,
  setArchived,
  declareUnavailability,
  endUnavailability,
  validateUnavailability,
  refuseUnavailability,
} from "./actions";
import { createInterview, updateObjectiveStatus, toggleObjectiveVisibility } from "./interview-actions";
import { addPlayerMeasurement, deleteMeasurement } from "../../mesures/actions";

const TABS = [
  { key: "assiduite", label: "Assiduité" },
  { key: "matchs", label: "Matchs" },
  { key: "performance", label: "Performance" },
  { key: "mesures", label: "Mesures" },
  { key: "entretiens", label: "Entretiens" },
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
  const [player, stats, allTeams, interviewPrep, measurementHistory, testTypes] = await Promise.all([
    prisma.player.findUnique({
      where: { id },
      include: {
        team: true,
        attendances: { include: { session: true }, orderBy: { session: { date: "desc" } }, take: 5 },
        matchStats: { include: { match: { include: { team: true } } }, orderBy: { match: { date: "desc" } } },
        evaluations: { orderBy: { createdAt: "desc" } },
        history: { include: { fromTeam: true, toTeam: true, decidedBy: true }, orderBy: { date: "desc" } },
        notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
        unavailabilities: { orderBy: { startDate: "desc" } },
        parentAccount: true,
        interviews: { include: { author: true, objectives: true }, orderBy: { date: "desc" } },
        objectives: { include: { updates: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } },
      },
    }),
    getPlayerStatsById(id),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
    getInterviewPrep(id),
    getPlayerMeasurementHistory(id),
    getTestTypes(),
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

          {tab === "assiduite" && (
            <Panel title="Derniers matchs" hint={`${stats.minutes} minutes cumulées · moyenne équipe ${stats.teamAvgMinutes}`}>
              {player.matchStats.slice(0, 4).map((m) => (
                <Row
                  key={m.id}
                  left={formatDateShort(m.match.date)}
                  title={`${m.match.team.code} — ${m.match.opponent ?? "Adversaire à définir"}`}
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

          {tab === "matchs" && (
            <>
              {player.matchStats.length > 0 && (
                <div className="grid grid-cols-2 gap-3.5">
                  <Panel title="Équipe habituelle" hint={`calculée sur ${player.matchStats.length} match${player.matchStats.length > 1 ? "s" : ""} joués`}>
                    <div className="px-3.5 py-2.5 flex flex-col gap-2">
                      {computeDistribution(player.matchStats.map((m) => m.match.team.code)).map((d) => (
                        <div key={d.value} className="flex items-center gap-2.5">
                          <TeamChip code={d.value} />
                          <div className="flex-1 h-1.5 rounded-full bg-bg overflow-hidden">
                            <div className="h-full bg-ink" style={{ width: `${d.pct}%` }} />
                          </div>
                          <span className="font-mono text-[11.5px] text-muted w-16 text-right">
                            {d.count} · {d.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel title="Postes réellement joués" hint="poste saisi sur la feuille de match, sinon poste habituel">
                    <div className="px-3.5 py-2.5 flex flex-col gap-2">
                      {computeDistribution(player.matchStats.map((m) => m.position ?? stats.position)).map((d) => (
                        <div key={d.value} className="flex items-center gap-2.5">
                          <span className="text-[12px] font-semibold w-24 shrink-0 truncate">{d.value}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-bg overflow-hidden">
                            <div className="h-full bg-ink" style={{ width: `${d.pct}%` }} />
                          </div>
                          <span className="font-mono text-[11.5px] text-muted w-16 text-right">
                            {d.count} · {d.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              )}

              <Panel title="Historique des matchs" hint={`${player.matchStats.length} match${player.matchStats.length > 1 ? "s" : ""} au total`}>
                {player.matchStats.map((m) => (
                  <Row
                    key={m.id}
                    left={formatDateShort(m.match.date)}
                    title={`${m.match.team.code} — ${m.match.opponent ?? "Adversaire à définir"}`}
                    detail={`${m.match.isHome ? "Domicile" : "Extérieur"} · ${m.match.competition} · ${m.role} · ${m.position ?? stats.position}${
                      m.goals || m.assists ? ` · ${m.goals} but${m.goals > 1 ? "s" : ""}, ${m.assists} passe${m.assists > 1 ? "s" : ""}` : ""
                    }`}
                    valueNode={
                      <span className={`font-mono text-[13px] font-bold ${m.minutes < 30 ? "text-red" : m.minutes < 45 ? "text-orange" : "text-green"}`}>
                        {m.minutes}&apos;
                      </span>
                    }
                  />
                ))}
                {player.matchStats.length === 0 && <EmptyRow text="Aucun match joué pour l'instant." />}
              </Panel>
            </>
          )}

          {tab === "performance" && (
            <>
              <Panel title={`Évaluation — période ${stats.currentEval?.period ?? "—"}`} hint={stats.previousEval ? `comparée à ${stats.previousEval.period}` : "aucune période précédente"}>
                {stats.currentEval ? (
                  (["technique", "tactique", "physique", "comportement"] as const).map((k) => {
                    const v = stats.currentEval![k];
                    const delta = computeEvaluationDelta(stats.currentEval!, stats.previousEval, k);
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

              {player.evaluations.length > 0 && (
                <Panel title="Progression" hint="moyenne sur 5, par période">
                  <div className="px-3.5 py-3">
                    <ProgressChart
                      points={[...player.evaluations]
                        .sort((a, b) => EVAL_PERIODS.indexOf(a.period) - EVAL_PERIODS.indexOf(b.period))
                        .map((e) => ({
                          label: e.period,
                          value: Math.round(((e.technique + e.tactique + e.physique + e.comportement) / 4) * 10) / 10,
                        }))}
                    />
                    <div className="flex justify-between text-[10.5px] text-muted-2 mt-1 px-1">
                      {[...player.evaluations]
                        .sort((a, b) => EVAL_PERIODS.indexOf(a.period) - EVAL_PERIODS.indexOf(b.period))
                        .map((e) => (
                          <span key={e.id}>{e.period}</span>
                        ))}
                    </div>
                  </div>
                </Panel>
              )}

              <Panel title="Historique des évaluations" hint={`${player.evaluations.length} période${player.evaluations.length > 1 ? "s" : ""}`}>
                {player.evaluations.map((e) => {
                  const moy = Math.round(((e.technique + e.tactique + e.physique + e.comportement) / 4) * 10) / 10;
                  return (
                    <div key={e.id} className="px-3.5 py-2.5 border-b border-line-soft-2 last:border-b-0">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[12.5px] font-semibold w-20">{e.period}</span>
                        <span className="font-mono text-[12.5px] text-muted">
                          T {e.technique.toFixed(1)} · Ta {e.tactique.toFixed(1)} · P {e.physique.toFixed(1)} · C {e.comportement.toFixed(1)}
                        </span>
                        <span className="flex-1" />
                        <span className="font-mono text-[13px] font-bold">{moy.toFixed(1)} / 5</span>
                      </div>
                      {e.objectives && <div className="text-[11.5px] text-ink-soft mt-1">Objectif : {e.objectives}</div>}
                      {e.id === player.evaluations[0].id && (
                        <form action={updateObjectives.bind(null, e.id)} className="mt-1.5 flex gap-1.5">
                          <input
                            name="objectives"
                            defaultValue={e.objectives ?? ""}
                            placeholder="Objectif individuel pour cette période…"
                            className="h-7 flex-1 border border-line rounded-md px-2 text-[11.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                          />
                          <button type="submit" className="h-7 px-2 border border-line rounded-md text-[10.5px] font-semibold text-muted hover:border-ink hover:text-ink">
                            OK
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </Panel>
            </>
          )}

          {tab === "mesures" && (
            <>
              <Panel title="Ajouter une mesure" hint="test, date et valeur">
                <form
                  action={addPlayerMeasurement.bind(null, player.id)}
                  className="grid grid-cols-[1fr_140px_110px_auto] gap-2 items-end px-3.5 py-3"
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Test</span>
                    <select
                      name="testTypeId"
                      required
                      className="h-8 border border-line rounded-md px-2 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                    >
                      {testTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.unit})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Date</span>
                    <input
                      type="date"
                      name="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className="h-8 border border-line rounded-md px-2 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">Valeur</span>
                    <input
                      type="number"
                      step="0.1"
                      name="value"
                      required
                      className="h-8 border border-line rounded-md px-2 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                    />
                  </label>
                  <button
                    type="submit"
                    className="h-8 px-3 border-none rounded-md bg-ink text-white text-xs font-semibold cursor-pointer hover:bg-[#2A2E36]"
                  >
                    Ajouter
                  </button>
                </form>
              </Panel>

              {measurementHistory.length === 0 && (
                <Panel title="Historique" hint="">
                  <EmptyRow text="Aucune mesure enregistrée pour ce joueur." />
                </Panel>
              )}

              {measurementHistory.map((group) => {
                const chronological = [...group.entries].reverse();
                const values = chronological.map((e) => e.value);
                const min = values.length ? Math.min(...values) : 0;
                const max = values.length ? Math.max(...values) : 1;
                const pad = (max - min) * 0.15 || 1;
                return (
                  <Panel
                    key={group.testType.id}
                    title={group.testType.name}
                    hint={`${group.entries.length} mesure${group.entries.length > 1 ? "s" : ""}`}
                  >
                    {chronological.length >= 2 && (
                      <div className="px-3.5 py-3 border-b border-line-soft-2">
                        <ProgressChart
                          points={chronological.map((e) => ({ label: formatDateShort(e.date), value: e.value }))}
                          min={min - pad}
                          max={max + pad}
                        />
                        <div className="flex justify-between text-[10.5px] text-muted-2 mt-1 px-1">
                          {chronological.map((e) => (
                            <span key={e.id}>{formatDateShort(e.date)}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {group.entries.map((e, i) => {
                      const previous = group.entries[i + 1];
                      const trend = previous ? computeMeasurementTrend(e.value, previous.value, group.testType.lowerIsBetter) : null;
                      return (
                        <div key={e.id} className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-line-soft-2 last:border-b-0">
                          <span className="text-[12.5px] text-muted w-24">{formatDateShort(e.date)}</span>
                          <span className="font-mono text-[13px] font-bold">
                            {e.value} {group.testType.unit}
                          </span>
                          {trend && (
                            <span
                              className={`text-[11px] font-semibold ${
                                trend === "up" ? "text-green" : trend === "down" ? "text-red" : "text-muted"
                              }`}
                            >
                              {trend === "up" ? "▲" : trend === "down" ? "▼" : "="}
                            </span>
                          )}
                          {e.note ? (
                            <span className="text-[11.5px] text-ink-soft flex-1 truncate">{e.note}</span>
                          ) : (
                            <span className="flex-1" />
                          )}
                          <form action={deleteMeasurement.bind(null, player.id, e.id)}>
                            <button type="submit" className="h-6 px-2 border border-line rounded-md text-[10.5px] font-semibold text-red hover:border-red">
                              Retirer
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </Panel>
                );
              })}
            </>
          )}

          {tab === "entretiens" && (
            <>
              <Panel
                title="Préparation automatique"
                hint={
                  interviewPrep.lastInterviewDaysAgo === null
                    ? "aucun entretien précédent"
                    : `dernier entretien il y a ${interviewPrep.lastInterviewDaysAgo} jours`
                }
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-3.5 py-3 text-[12.5px]">
                  <PrepFact label="Assiduité" value={`${Math.round(stats.attendanceRate * 100)}% (${stats.seances} séances)`} />
                  <PrepFact label="Absences non justifiées récentes" value={`${stats.recentANJ}`} />
                  <PrepFact
                    label="Temps de jeu vs équipe"
                    value={`${stats.ecart >= 0 ? "+" : ""}${stats.ecart}' (moy. équipe ${stats.teamAvgMinutes}')`}
                  />
                  <PrepFact
                    label="Dernière évaluation"
                    value={stats.currentEval ? `période ${stats.currentEval.period}` : "aucune"}
                  />
                  <PrepFact label="Objectifs en cours" value={`${interviewPrep.objectivesInProgress}`} />
                  <PrepFact
                    label="Wellness récent"
                    value={
                      interviewPrep.wellness.sampleSize === 0
                        ? "aucune réponse récente"
                        : [
                            interviewPrep.wellness.avgPostFeeling !== null ? `ressenti moy. ${interviewPrep.wellness.avgPostFeeling.toFixed(1)}/5` : null,
                            interviewPrep.wellness.avgRpe !== null ? `RPE moy. ${interviewPrep.wellness.avgRpe.toFixed(1)}/10` : null,
                            interviewPrep.wellness.painCount > 0 ? `${interviewPrep.wellness.painCount} douleur(s) signalée(s)` : null,
                            interviewPrep.wellness.highFatigueCount > 0 ? `${interviewPrep.wellness.highFatigueCount} fatigue élevée` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || `sur ${interviewPrep.wellness.sampleSize} dernières séances`
                    }
                  />
                  <PrepFact
                    label="5 derniers matchs"
                    value={player.matchStats.map((m) => `${m.minutes}'`).join(" · ") || "aucun match"}
                  />
                </div>
              </Panel>

              {player.objectives.length > 0 && (
                <Panel title="Objectifs" hint={`${interviewPrep.objectivesInProgress} en cours`}>
                  {player.objectives.map((o) => (
                    <div key={o.id} className="px-3.5 py-2.5 border-b border-line-soft-2 last:border-b-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12.5px] font-semibold">{o.title}</span>
                        <Badge tone="neutral">{OBJECTIVE_CATEGORY_LABELS[o.category] ?? o.category}</Badge>
                        <Badge
                          tone={o.status === "ACQUIS" ? "green" : o.status === "ABANDONNE" ? "neutral" : o.status === "EN_PROGRESSION" ? "blue" : "orange"}
                        >
                          {OBJECTIVE_STATUS_LABELS[o.status] ?? o.status}
                        </Badge>
                        {o.visibleToPlayer && <Badge tone="green">Visible côté joueur</Badge>}
                      </div>
                      {o.description && <div className="text-[11.5px] text-ink-soft mt-1">{o.description}</div>}
                      {o.targetDate && <div className="text-[11px] text-muted mt-0.5">Échéance : {formatDateShort(o.targetDate)}</div>}
                      {o.updates.length > 0 && (
                        <div className="mt-1.5 flex flex-col gap-0.5">
                          {o.updates.map((u) => (
                            <div key={u.id} className="text-[11px] text-muted-2">
                              {formatDateShort(u.createdAt)} — {u.comment}
                            </div>
                          ))}
                        </div>
                      )}
                      <form action={updateObjectiveStatus.bind(null, id, o.id)} className="mt-2 flex gap-1.5 flex-wrap items-center">
                        <select name="status" defaultValue={o.status} className="h-7 border border-line rounded-md px-1.5 text-[11px] bg-surface">
                          {Object.entries(OBJECTIVE_STATUS_LABELS).map(([k, l]) => (
                            <option key={k} value={k}>{l}</option>
                          ))}
                        </select>
                        <input
                          name="comment"
                          placeholder="Commentaire (optionnel)…"
                          className="h-7 flex-1 min-w-[120px] border border-line rounded-md px-2 text-[11px] bg-surface"
                        />
                        <button type="submit" className="h-7 px-2 border border-line rounded-md text-[10.5px] font-semibold text-muted hover:border-ink hover:text-ink">
                          Mettre à jour
                        </button>
                      </form>
                      <form action={toggleObjectiveVisibility.bind(null, id, o.id, !o.visibleToPlayer)} className="mt-1">
                        <button type="submit" className="text-[10.5px] text-blue hover:underline">
                          {o.visibleToPlayer ? "Retirer de l'espace joueur" : "Publier dans l'espace joueur"}
                        </button>
                      </form>
                    </div>
                  ))}
                </Panel>
              )}

              <section className="bg-surface border border-line rounded-lg overflow-hidden">
                <details>
                  <summary className="px-3.5 py-[11px] border-b border-line-soft cursor-pointer text-[11px] font-bold tracking-[0.11em] uppercase text-muted">
                    + Nouvel entretien
                  </summary>
                  <form action={createInterview.bind(null, id)} className="p-3.5 flex flex-col gap-3.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <EditField label="Type d'entretien">
                        <select name="type" defaultValue="POINT_INTERMEDIAIRE" className={editInputClass}>
                          {Object.entries(INTERVIEW_TYPE_LABELS).map(([k, l]) => (
                            <option key={k} value={k}>{l}</option>
                          ))}
                        </select>
                      </EditField>
                      <EditField label="Date">
                        <input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className={editInputClass} />
                      </EditField>
                    </div>

                    <FormSection title="La parole du joueur" hint="champs libres, jamais obligatoires">
                      <TextField name="playerFeeling" placeholder="Comment il/elle se sent en ce moment…" />
                      <TextField name="playerFeedback" placeholder="Ce qu'il/elle pense de sa saison, de son rôle…" />
                      <TextField name="playerExpectations" placeholder="Ce qu'il/elle souhaite, ses attentes…" />
                      <TextField name="playerDifficulties" placeholder="Ses difficultés éventuelles…" />
                    </FormSection>

                    <FormSection title="Retour du coach">
                      <TextField name="coachFeedback" placeholder="Retour général du staff…" />
                      <TextField name="strengths" placeholder="Points forts…" />
                      <TextField name="developmentAreas" placeholder="Axes de progression…" />
                    </FormSection>

                    <FormSection title="Objectifs décidés ensemble" hint="jusqu'à 3, optionnels">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="grid grid-cols-[1fr_140px_130px] gap-1.5">
                          <input name={`objectiveTitle${i}`} placeholder={`Objectif ${i + 1}…`} className={editInputClass} />
                          <select name={`objectiveCategory${i}`} defaultValue="TECHNIQUE" className={editInputClass}>
                            {Object.entries(OBJECTIVE_CATEGORY_LABELS).map(([k, l]) => (
                              <option key={k} value={k}>{l}</option>
                            ))}
                          </select>
                          <input type="date" name={`objectiveTargetDate${i}`} className={editInputClass} />
                        </div>
                      ))}
                    </FormSection>

                    <FormSection title="Suivi">
                      <TextField name="agreedSummary" placeholder="Résumé des décisions communes…" />
                      <div className="grid grid-cols-2 gap-2.5">
                        <EditField label="Prochain point prévu le">
                          <input type="date" name="nextReviewDate" className={editInputClass} />
                        </EditField>
                      </div>
                      <TextField name="privateNotes" placeholder="Notes privées (jamais visibles côté parent/joueur)…" />
                    </FormSection>

                    <button type="submit" className={editButtonClass}>Enregistrer l&apos;entretien</button>
                  </form>
                </details>
              </section>

              <Panel title="Historique des entretiens" hint={`${player.interviews.length} entretien${player.interviews.length > 1 ? "s" : ""}`}>
                {player.interviews.map((iv) => (
                  <details key={iv.id} className="border-b border-line-soft-2 last:border-b-0">
                    <summary className="px-3.5 py-2.5 cursor-pointer flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[11.5px] text-muted w-20 shrink-0">{formatDateShort(iv.date)}</span>
                      <span className="text-[12.5px] font-semibold">{INTERVIEW_TYPE_LABELS[iv.type] ?? iv.type}</span>
                      <span className="flex-1" />
                      <span className="text-[11px] text-muted-2">{iv.author.name.split(" ")[0]}</span>
                    </summary>
                    <div className="px-3.5 pb-3 flex flex-col gap-2.5">
                      <InterviewField label="Ressenti joueur" value={iv.playerFeeling} />
                      <InterviewField label="Retour joueur" value={iv.playerFeedback} />
                      <InterviewField label="Attentes joueur" value={iv.playerExpectations} />
                      <InterviewField label="Difficultés" value={iv.playerDifficulties} />
                      <InterviewField label="Retour coach" value={iv.coachFeedback} />
                      <InterviewField label="Points forts" value={iv.strengths} />
                      <InterviewField label="Axes de progression" value={iv.developmentAreas} />
                      <InterviewField label="Décisions communes" value={iv.agreedSummary} />
                      <InterviewField label="Notes privées" value={iv.privateNotes} />
                      {iv.nextReviewDate && (
                        <div className="text-[11.5px] text-muted">Prochain point prévu le {formatDateShort(iv.nextReviewDate)}</div>
                      )}
                    </div>
                  </details>
                ))}
                {player.interviews.length === 0 && <EmptyRow text="Aucun entretien enregistré pour l'instant." />}
              </Panel>
            </>
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
              <EditField label="Prénom">
                <input name="firstName" defaultValue={player.firstName} className={editInputClass} />
              </EditField>
              <EditField label="Nom">
                <input name="lastName" defaultValue={player.lastName} className={editInputClass} />
              </EditField>
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
            <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mb-[11px]">Infos parents</div>
            <form action={updateParentContact.bind(null, id)} className="flex flex-col gap-2.5">
              <EditField label="Nom du parent">
                <input name="parentName" defaultValue={player.parentName ?? ""} placeholder="Non renseigné" className={editInputClass} />
              </EditField>
              <EditField label="Téléphone">
                <input name="parentPhone" defaultValue={player.parentPhone ?? ""} placeholder="Non renseigné" className={editInputClass} />
              </EditField>
              <EditField label="Email">
                <input type="email" name="parentEmail" defaultValue={player.parentEmail ?? ""} placeholder="Non renseigné" className={editInputClass} />
              </EditField>
              <button type="submit" className={editButtonClass}>Enregistrer</button>
            </form>
          </div>

          {user.role === "ADMIN" && (
            <ParentAccountPanel
              playerId={player.id}
              playerName={`${player.firstName} ${player.lastName}`}
              account={player.parentAccount ? { id: player.parentAccount.id, username: player.parentAccount.username, active: player.parentAccount.active } : null}
            />
          )}

          <div className="bg-surface border border-line rounded-lg px-3.5 py-[13px]">
            <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mb-[11px]">Indisponibilités</div>
            <div className="flex flex-col gap-2.5">
              {player.unavailabilities.map((u) => (
                <div
                  key={u.id}
                  className="border-l-2 pl-2.5"
                  style={{ borderColor: u.status === "PENDING" ? "#C97A17" : u.actualReturn ? "#D2D2CB" : "#C4362C" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold">{u.type}</span>
                    {u.status === "PENDING" && <Badge tone="orange">Déclarée par la famille — à valider</Badge>}
                    {u.status === "REFUSED" && <Badge tone="neutral">Refusée</Badge>}
                    {u.status === "VALIDATED" && !u.actualReturn && <Badge tone="red">En cours</Badge>}
                  </div>
                  <div className="text-[11.5px] text-muted mt-px">
                    depuis {formatDateShort(u.startDate)}
                    {u.expectedReturn ? ` · retour prévu ${formatDateShort(u.expectedReturn)}` : ""}
                    {u.actualReturn ? ` · retour effectif ${formatDateShort(u.actualReturn)}` : ""}
                  </div>
                  {u.description && <div className="text-[11.5px] text-ink-soft mt-1">{u.description}</div>}
                  {u.status === "PENDING" ? (
                    <div className="flex gap-1.5 mt-1.5">
                      <form action={validateUnavailability.bind(null, id, u.id)}>
                        <button type="submit" className="h-6 px-2 border border-line rounded-md text-[10.5px] font-semibold text-green hover:border-green">
                          Valider
                        </button>
                      </form>
                      <form action={refuseUnavailability.bind(null, id, u.id)}>
                        <button type="submit" className="h-6 px-2 border border-line rounded-md text-[10.5px] font-semibold text-red hover:border-red">
                          Refuser
                        </button>
                      </form>
                    </div>
                  ) : (
                    u.status === "VALIDATED" &&
                    !u.actualReturn && (
                      <form action={endUnavailability.bind(null, id, u.id)} className="mt-1.5">
                        <button type="submit" className="h-6 px-2 border border-line rounded-md text-[10.5px] font-semibold text-green hover:border-green">
                          Marquer de retour
                        </button>
                      </form>
                    )
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

function PrepFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] text-muted uppercase tracking-[0.05em]">{label}</div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}

function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line-soft pt-3 first:border-t-0 first:pt-0">
      <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-muted mb-2">
        {title}
        {hint && <span className="text-muted-2 font-normal normal-case tracking-normal ml-1.5">— {hint}</span>}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function TextField({ name, placeholder }: { name: string; placeholder: string }) {
  return (
    <textarea
      name={name}
      rows={2}
      placeholder={placeholder}
      className="w-full border border-line rounded-md px-2.5 py-2 text-[12.5px] outline-none focus:border-blue resize-none bg-surface"
    />
  );
}

function InterviewField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10.5px] font-bold tracking-[0.06em] uppercase text-muted-2">{label}</div>
      <div className="text-[12.5px] text-ink-soft mt-0.5 whitespace-pre-wrap">{value}</div>
    </div>
  );
}
