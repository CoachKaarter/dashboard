import { prisma } from "@/lib/prisma";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { formatDateShort } from "@/lib/format";
import { requireUser, teamScopeWhere, scopedTeamIds } from "@/lib/authz";
import { getAlertGroups } from "@/lib/alerts";
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  CONDITIONS,
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_TONE,
  computeEquipmentDisplayStatus,
  daysLate,
  playerMatchesEquipmentCategory,
  type EquipmentAssignmentLike,
} from "@/lib/equipment";
import {
  createEquipment,
  assignEquipment,
  reassignEquipment,
  updateAssignment,
  setAssignmentCondition,
  setAssignmentWashed,
  setAssignmentComment,
  markEquipmentRecovered,
  deleteEquipment,
} from "./actions";

const inputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg w-full";

export default async function MaterielPage() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);
  const now = new Date();

  const [equipmentList, allTeams, allPlayers, recentMatches, alertGroups] = await Promise.all([
    prisma.equipment.findMany({
      where: { OR: [{ teamId: null }, teamScopeWhere(user)] },
      include: {
        team: true,
        assignments: {
          orderBy: { createdAt: "desc" },
          include: { player: true, match: { include: { team: true } } },
        },
      },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    }),
    prisma.team.findMany({ orderBy: { code: "asc" } }),
    prisma.player.findMany({
      where: { archived: false },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, category: true },
    }),
    prisma.match.findMany({
      where: { ...teamScopeWhere(user), status: { not: "Annulé" } },
      orderBy: { date: "desc" },
      take: 100,
      select: { id: true, date: true, opponent: true, competition: true, teamId: true },
    }),
    getAlertGroups(scope),
  ]);
  const teams = scope === "ALL" ? allTeams : allTeams.filter((t) => scope.includes(t.id));
  // Cockpit v1.1 §6 — les mêmes alertes matériel que l'accueil, mais
  // recentrées ici et pointant directement (ancre #assignmentId) sur la
  // ligne concernée, sans dupliquer le calcul de statut.
  const equipmentAlerts = alertGroups
    .flatMap((g) => g.items.filter((i) => !i.treated && i.href.startsWith("/materiel#")).map((i) => ({ ...i, tone: g.tone })))
    .slice(0, 8);

  return (
    <div className="max-w-[1200px] mx-auto animate-fadein flex flex-col gap-4">
      {equipmentAlerts.length > 0 && (
        <div className="bg-surface border border-line rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 h-[34px] bg-[#FAFAF8] border-b border-line">
            <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Alertes matériel</span>
            <span className="text-[11px] text-muted-2">({equipmentAlerts.length})</span>
          </div>
          {equipmentAlerts.map((a) => (
            <a
              key={a.key}
              href={a.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 border-b border-line-soft-2 last:border-b-0 hover:bg-bg/60 ${
                a.tone === "red" ? "text-red" : a.tone === "orange" ? "text-orange" : "text-blue"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${a.tone === "red" ? "bg-red" : a.tone === "orange" ? "bg-orange" : "bg-blue"}`} />
              <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-ink truncate">{a.title}</span>
              <span className="text-[11.5px] text-muted-2 whitespace-nowrap">{a.detail}</span>
            </a>
          ))}
        </div>
      )}
      {EQUIPMENT_CATEGORIES.map((category) => {
        const items = equipmentList.filter((e) => e.category === category);
        if (items.length === 0 && category !== "MAILLOTS") return null;
        return (
          <div key={category} className="bg-surface border border-line rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 h-[38px] bg-[#FAFAF8] border-b border-line">
              <span className="text-[12.5px] font-bold">{EQUIPMENT_CATEGORY_LABELS[category]}</span>
              <span className="text-[11px] text-muted-2">({items.length})</span>
            </div>
            {items.length === 0 && <div className="px-4 py-8 text-center text-muted text-[13px]">Aucun matériel enregistré dans cette catégorie.</div>}
            {items.map((e) => {
              const active = (e.assignments.find((a) => a.status !== "RECUPERE_STAFF") ?? null) as (typeof e.assignments)[number] | null;
              const displayStatus = computeEquipmentDisplayStatus(active as EquipmentAssignmentLike | null, now);
              const late = active ? daysLate(active as EquipmentAssignmentLike, now) : 0;
              const eligibleMatches = recentMatches.filter((m) => !e.teamId || m.teamId === e.teamId);
              return (
                <details key={e.id} id={active?.id ?? e.id} className="border-b border-line-soft-2 last:border-b-0 group">
                  <summary className="cursor-pointer list-none px-3.5 py-2.5 flex items-center gap-3 flex-wrap hover:bg-bg">
                    <span className="font-mono text-[12px] text-muted shrink-0">{e.code}</span>
                    {e.team && <TeamChip code={e.team.code} />}
                    <span className="text-[12.5px] font-semibold flex-1 min-w-[140px] truncate">
                      {active ? active.responsibleLabel : <span className="text-muted-2 italic font-normal">Disponible</span>}
                    </span>
                    {active && <span className="font-mono text-[11.5px] text-muted shrink-0">retour {formatDateShort(active.dueDate)}</span>}
                    <Badge tone={DISPLAY_STATUS_TONE[displayStatus]}>{late > 0 ? `${DISPLAY_STATUS_LABELS[displayStatus]} · +${late} j.` : DISPLAY_STATUS_LABELS[displayStatus]}</Badge>
                    <span className="text-muted-2 text-[11px] ml-auto shrink-0 group-open:hidden">Détails ▾</span>
                    <span className="text-muted-2 text-[11px] ml-auto shrink-0 hidden group-open:inline">Fermer ▴</span>
                  </summary>

                  <div className="px-3.5 pb-3.5 flex flex-col gap-3">
                    {active ? (
                      <>
                        <form action={updateAssignment.bind(null, active.id)} className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <select name="playerId" defaultValue={active.playerId ?? ""} className={inputClass}>
                            <option value="">Aucun joueur lié</option>
                            {allPlayers
                              .filter((p) => playerMatchesEquipmentCategory(e.team, p))
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.firstName} {p.lastName}
                                </option>
                              ))}
                          </select>
                          <input name="responsibleLabel" defaultValue={active.responsibleLabel} required placeholder="Responsable" className={inputClass} />
                          <select name="matchId" defaultValue={active.matchId ?? ""} className={inputClass}>
                            <option value="">Aucune rencontre associée</option>
                            {eligibleMatches.map((m) => (
                              <option key={m.id} value={m.id}>
                                {formatDateShort(m.date)} · {m.opponent ?? "adversaire à définir"}
                              </option>
                            ))}
                          </select>
                          <input type="date" name="dueDate" defaultValue={active.dueDate.toISOString().slice(0, 10)} required className={inputClass} />
                          <input
                            name="returnLocation"
                            defaultValue={active.returnLocation ?? ""}
                            placeholder="Lieu/événement du retour (ex. Entraînement du mercredi)"
                            className={`${inputClass} col-span-2 md:col-span-3`}
                          />
                          <button type="submit" className="h-9 rounded-md border border-line text-[12px] font-semibold text-ink-soft hover:border-ink">
                            Enregistrer
                          </button>
                        </form>

                        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-line-soft">
                          <form action={setAssignmentCondition.bind(null, active.id)} className="flex items-center gap-1.5">
                            <select name="condition" defaultValue={active.condition ?? ""} className={`${inputClass} !w-auto h-8`}>
                              <option value="" disabled>
                                État au retour
                              </option>
                              {CONDITIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <button type="submit" className="h-8 px-2 border border-line rounded-md text-[10.5px] font-semibold text-muted hover:border-ink hover:text-ink">
                              OK
                            </button>
                          </form>
                          <form action={setAssignmentWashed.bind(null, active.id)} className="flex items-center gap-1.5">
                            <label className="flex items-center gap-1.5 text-[12px] text-ink-soft h-8 px-2 border border-line rounded-md">
                              <input type="checkbox" name="washed" defaultChecked={active.washed ?? false} className="w-3.5 h-3.5" />
                              Lavé
                            </label>
                            <button type="submit" className="h-8 px-2 border border-line rounded-md text-[10.5px] font-semibold text-muted hover:border-ink hover:text-ink">
                              OK
                            </button>
                          </form>
                          {active.status === "RETOUR_SIGNALE_PARENT" && <Badge tone="orange">Retour signalé par le parent — à confirmer</Badge>}
                          <form action={markEquipmentRecovered.bind(null, active.id)} className="ml-auto">
                            <button type="submit" className="h-8 px-3 border border-line rounded-md text-[11px] font-semibold text-green hover:border-green">
                              Confirmer la récupération
                            </button>
                          </form>
                        </div>

                        <form action={setAssignmentComment.bind(null, active.id)} className="flex gap-1.5">
                          <input name="staffComment" defaultValue={active.staffComment ?? ""} placeholder="Commentaire du staff" className={inputClass} />
                          <button type="submit" className="h-9 px-3 border border-line rounded-md text-[11.5px] font-semibold text-muted hover:border-ink hover:text-ink shrink-0">
                            Enregistrer
                          </button>
                        </form>

                        <details className="pt-1">
                          <summary className="cursor-pointer text-[11.5px] font-semibold text-muted hover:text-ink select-none">
                            + Réattribuer maintenant (referme ce prêt)
                          </summary>
                          <AssignForm action={reassignEquipment.bind(null, e.id)} players={allPlayers.filter((p) => playerMatchesEquipmentCategory(e.team, p))} matches={eligibleMatches} />
                        </details>
                      </>
                    ) : (
                      <AssignForm action={assignEquipment.bind(null, e.id)} players={allPlayers.filter((p) => playerMatchesEquipmentCategory(e.team, p))} matches={eligibleMatches} />
                    )}

                    {e.assignments.length > 0 && (
                      <details className="pt-1">
                        <summary className="cursor-pointer text-[11.5px] font-semibold text-muted hover:text-ink select-none">
                          Historique des attributions ({e.assignments.length})
                        </summary>
                        <div className="mt-2 flex flex-col gap-1.5">
                          {e.assignments.map((a) => (
                            <div key={a.id} className="text-[11.5px] text-ink-soft border border-line-soft rounded-md px-2.5 py-1.5">
                              <span className="font-semibold">{a.responsibleLabel}</span> — {formatDateShort(a.issuedDate)} → {formatDateShort(a.dueDate)}
                              {a.returnedDate ? ` · récupéré le ${formatDateShort(a.returnedDate)}` : " · en cours"}
                              {a.condition ? ` · ${a.condition}` : ""}
                              {a.washed ? " · lavé" : ""}
                              {a.staffComment ? ` · « ${a.staffComment} »` : ""}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    <form action={deleteEquipment.bind(null, e.id)} className="pt-1">
                      <button type="submit" className="text-[11px] font-semibold text-red hover:underline">
                        Supprimer ce matériel définitivement
                      </button>
                    </form>
                  </div>
                </details>
              );
            })}
          </div>
        );
      })}

      <div className="bg-surface border border-line rounded-lg p-3.5">
        <div className="text-[12.5px] font-bold mb-2.5">Nouveau matériel</div>
        <form action={createEquipment} className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <select name="category" defaultValue="MAILLOTS" className={inputClass}>
            {EQUIPMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EQUIPMENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <input name="code" required placeholder="Code (ex. SAC021)" className={inputClass} />
          <select name="teamId" defaultValue="" className={inputClass}>
            <option value="">Toutes équipes / non lié</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code}
              </option>
            ))}
          </select>
          <input name="label" placeholder="Libellé (optionnel)" className={inputClass} />
          <button type="submit" className="col-span-2 md:col-span-4 h-9 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
            Créer
          </button>
        </form>
      </div>
    </div>
  );
}

function AssignForm({
  action,
  players,
  matches,
}: {
  action: (formData: FormData) => Promise<void>;
  players: { id: string; firstName: string; lastName: string }[];
  matches: { id: string; date: Date; opponent: string | null }[];
}) {
  return (
    <form action={action} className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
      <select name="playerId" defaultValue="" className={inputClass}>
        <option value="">Aucun joueur lié</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.firstName} {p.lastName}
          </option>
        ))}
      </select>
      <input name="responsibleLabel" required placeholder="Responsable (ex. Famille Dupont)" className={inputClass} />
      <select name="matchId" defaultValue="" className={inputClass}>
        <option value="">Aucune rencontre associée</option>
        {matches.map((m) => (
          <option key={m.id} value={m.id}>
            {formatDateShort(m.date)} · {m.opponent ?? "adversaire à définir"}
          </option>
        ))}
      </select>
      <input type="date" name="dueDate" className={inputClass} />
      <input name="returnLocation" placeholder="Lieu/événement du retour" className={`${inputClass} col-span-2 md:col-span-3`} />
      <button type="submit" className="h-9 rounded-md bg-ink text-white text-[12px] font-semibold hover:bg-[#2A2E36]">
        Attribuer
      </button>
    </form>
  );
}
