import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { prisma } from "@/lib/prisma";
import { getPlayerStatsByTeam } from "@/lib/stats";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { CompositionBoard } from "@/components/CompositionBoard";
import { NumField } from "@/components/ui/NumField";
import { SelectField } from "@/components/ui/SelectField";
import { formatDateFull } from "@/lib/format";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { computeBench } from "@/lib/composition-pool";
import { Badge } from "@/components/ui/Badge";
import { POSITIONS } from "@/lib/constants";
import { MATCH_ROLES } from "@/lib/match-validation";
import {
  toggleConvocation,
  recordScore,
  generateFeuille,
  updateStatRow,
  updateMatch,
  updateBilan,
  cancelMatch,
  deleteMatch,
} from "../actions";

const TABS = [
  { key: "convocation", label: "Convocation" },
  { key: "composition", label: "Composition" },
  { key: "feuille", label: "Feuille de match" },
];

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;

  const user = await requireUser();
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      team: true,
      convocations: { include: { player: true } },
      slots: { include: { player: true } },
      stats: { include: { player: true }, orderBy: { role: "asc" } },
    },
  });
  if (!match) notFound();
  if (!canAccessTeam(user, match.teamId)) notFound();

  const defaultTab = match.status === "Joué" ? "feuille" : "convocation";
  const tab = TABS.some((t) => t.key === rawTab) ? rawTab! : defaultTab;

  const [squad, hdrs] = await Promise.all([getPlayerStatsByTeam(match.team.code), headers()]);
  const convocatedIds = new Set(match.convocations.map((c) => c.playerId));
  const host = hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const shareUrl = `${proto}://${host}/convocation/${match.shareToken}`;
  const confirmedCount = match.convocations.filter((c) => c.confirmed === true).length;
  const declinedCount = match.convocations.filter((c) => c.confirmed === false).length;
  const whatsappText = [
    `Convocation ${match.team.code} — vs ${match.opponent ?? "adversaire à définir"}`,
    `${formatDateFull(match.date)}${match.time ? ` à ${match.time}` : ""}`,
    match.meetTime ? `Rendez-vous : ${match.meetTime}` : null,
    match.location ? `Lieu : ${match.location}` : null,
    "",
    `Confirmez votre présence ici : ${shareUrl}`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  const played = match.status === "Joué";
  const stage = played ? (match.stats.length > 0 ? 4 : 3) : convocatedIds.size >= match.needed ? 2 : 1;
  const steps = ["Créé", "Convocation", "Composition", "Joué", "Statistiques", "Évaluation"];

  const cancelled = match.status === "Annulé";

  return (
    <div className="max-w-[1500px] mx-auto animate-fadein">
      <Link href="/matchs" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Tous les matchs
      </Link>

      <div className="bg-surface border border-line rounded-lg px-[18px] py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <TeamChip code={match.team.code} />
          <div className="text-xl font-bold tracking-[-0.02em]">{match.opponent ?? "Adversaire à définir"}</div>
          {cancelled && <Badge tone="red">Annulé</Badge>}
          <span className="flex-1" />
          {!played ? (
            <div className="font-mono text-xs text-muted">
              {convocatedIds.size} / {match.needed} convoqués
            </div>
          ) : (
            <div className="font-mono text-sm font-bold">
              {match.scoreFor} – {match.scoreAgainst}
            </div>
          )}
        </div>
        <div className="text-muted text-[12.5px] mt-[5px]">
          {formatDateFull(match.date)} · {match.competition} · {match.isHome ? "Domicile" : "Extérieur"} ·{" "}
          {match.location ?? "lieu à définir"} · coup d&apos;envoi {match.time ?? "—"}
        </div>
        {match.preMatchObjective && (
          <div className="text-[12.5px] mt-1.5">
            <span className="text-muted-2">Objectif :</span> <span className="font-semibold">{match.preMatchObjective}</span>
          </div>
        )}
        {match.mainInstructions && (
          <div className="text-[12.5px] mt-1">
            <span className="text-muted-2">Consignes :</span> <span className="font-semibold">{match.mainInstructions}</span>
          </div>
        )}
        {match.competition === "Tournoi" && match.tournamentRanking && match.tournamentTeamsCount && (
          <div className="text-[12.5px] mt-1">
            <span className="text-muted-2">Classement :</span>{" "}
            <span className="font-semibold">
              {match.tournamentRanking}e / {match.tournamentTeamsCount} équipes
            </span>
          </div>
        )}

        <div className="flex items-center mt-3.5 pt-3 border-t border-line-soft flex-wrap gap-y-2">
          {steps.map((label, i) => {
            const state = i < stage ? "done" : i === stage ? "current" : "todo";
            const fg = state === "done" ? "#3F8F5B" : state === "current" ? "#16181C" : "#9A9DA3";
            return (
              <div key={label} className="flex items-center gap-2 pr-3.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold"
                  style={{
                    color: state === "todo" ? "#9A9DA3" : "#FFFFFF",
                    background: state === "done" ? "#3F8F5B" : state === "current" ? "#16181C" : "#EFEFEC",
                  }}
                >
                  {i + 1}
                </span>
                <span className="text-xs" style={{ fontWeight: state === "current" ? 700 : 500, color: fg }}>
                  {label}
                </span>
                {i < steps.length - 1 && <span className="w-[26px] h-px bg-line ml-2" />}
              </div>
            );
          })}
        </div>

        {!played && !cancelled && (
          <form action={recordScore.bind(null, match.id)} className="flex items-center gap-2 mt-3.5 pt-3 border-t border-line-soft">
            <span className="text-xs text-muted mr-1">Enregistrer le score :</span>
            <input name="scoreFor" type="number" min={0} required className="w-14 h-8 border border-line rounded-md text-center text-[13px]" />
            <span className="text-muted">–</span>
            <input name="scoreAgainst" type="number" min={0} required className="w-14 h-8 border border-line rounded-md text-center text-[13px]" />
            <button type="submit" className="h-8 px-3 rounded-md bg-ink text-white text-xs font-semibold hover:bg-[#2A2E36]">
              Marquer le match comme joué
            </button>
          </form>
        )}
      </div>

      <details className="bg-surface border border-line rounded-lg mt-3.5">
        <summary className="cursor-pointer px-3.5 py-2.5 text-[12.5px] font-semibold text-muted hover:text-ink select-none">
          Modifier / annuler le match
        </summary>
        <div className="px-3.5 pb-3.5 flex flex-col gap-2.5">
          <form action={updateMatch.bind(null, match.id)} className="grid grid-cols-2 gap-2.5">
            <input name="opponent" defaultValue={match.opponent ?? ""} placeholder="Adversaire" className={matchInputClass} />
            <select name="competition" defaultValue={match.competition} className={matchInputClass}>
              <option value="Championnat">Championnat</option>
              <option value="Amical">Amical</option>
              <option value="Tournoi">Tournoi</option>
              <option value="Coupe">Coupe</option>
              <option value="Plateau">Plateau</option>
              <option value="Autre">Autre</option>
            </select>
            <input type="date" name="date" defaultValue={match.date.toISOString().slice(0, 10)} className={matchInputClass} />
            <input type="time" name="time" defaultValue={match.time ?? ""} className={matchInputClass} />
            <input name="location" defaultValue={match.location ?? ""} placeholder="Lieu" className={matchInputClass} />
            <input type="number" name="needed" defaultValue={match.needed} min={7} max={16} className={matchInputClass} />
            <input
              name="preMatchObjective"
              defaultValue={match.preMatchObjective ?? ""}
              placeholder="Objectif avant match (ex. Gagner les duels)"
              className={`${matchInputClass} col-span-2`}
            />
            <input
              name="mainInstructions"
              defaultValue={match.mainInstructions ?? ""}
              placeholder="Consignes principales"
              className={`${matchInputClass} col-span-2`}
            />
            <textarea
              name="preMatchNotes"
              defaultValue={match.preMatchNotes ?? ""}
              placeholder="Notes libres avant-match…"
              rows={2}
              className={`${matchInputClass} col-span-2 h-auto py-2 resize-y`}
            />
            <label className="flex items-center gap-2 text-[12.5px] text-ink-soft col-span-2">
              <input type="checkbox" name="isHome" defaultChecked={match.isHome} className="w-4 h-4" />
              Match à domicile
            </label>
            <div className="col-span-2 pt-2 border-t border-line-soft grid grid-cols-2 gap-2.5">
              <div className="col-span-2 text-[11px] font-bold tracking-[0.08em] uppercase text-muted-2">
                Tournoi (facultatif — renseignable une fois terminé)
              </div>
              <input
                type="number"
                name="tournamentRanking"
                defaultValue={match.tournamentRanking ?? ""}
                min={1}
                placeholder="Classement final (ex. 3)"
                className={matchInputClass}
              />
              <input
                type="number"
                name="tournamentTeamsCount"
                defaultValue={match.tournamentTeamsCount ?? ""}
                min={2}
                placeholder="Nombre d'équipes (ex. 16)"
                className={matchInputClass}
              />
            </div>
            <button type="submit" className="col-span-2 h-9 border-none rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
              Enregistrer les modifications
            </button>
          </form>
          <div className="flex gap-2.5 pt-2 border-t border-line-soft">
            {!cancelled && (
              <form action={cancelMatch.bind(null, match.id)}>
                <button type="submit" className="h-9 px-3 border border-line rounded-md text-xs font-semibold text-orange hover:border-orange">
                  Annuler le match
                </button>
              </form>
            )}
            <form action={deleteMatch.bind(null, match.id)}>
              <button type="submit" className="h-9 px-3 border border-line rounded-md text-xs font-semibold text-red hover:border-red">
                Supprimer définitivement
              </button>
            </form>
          </div>
        </div>
      </details>

      <div className="flex gap-1 my-3.5 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/matchs/${id}?tab=${t.key}`}
            className={`h-8 px-3.5 text-[12.5px] -mb-px border-b-2 flex items-center ${
              tab === t.key ? "border-ink font-semibold text-ink" : "border-transparent font-medium text-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "convocation" && (
        <div className="grid grid-cols-[minmax(0,1fr)_330px] gap-4 items-start">
          <section className="bg-surface border border-line rounded-lg overflow-auto">
            <div className="flex items-center gap-2 px-3.5 py-[11px] border-b border-line-soft">
              <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Convoqués</span>
              <span className="flex-1" />
              <span className="text-[11.5px] text-muted-2">
                Vient de la répartition du week-end — modifiable ici pour les exceptions
              </span>
            </div>
            {match.convocations.length === 0 && (
              <div className="px-4 py-8 text-center text-muted text-[13px]">
                Aucun joueur convoqué pour l&apos;instant. Publiez la répartition depuis{" "}
                <Link href="/week-end" className="text-blue font-semibold hover:underline">
                  Week-end
                </Link>
                , ou ajoutez un joueur ci-dessous.
              </div>
            )}
            {match.convocations.map((c) => (
              <div key={c.id} className="w-full flex items-center gap-2.5 px-3.5 py-2 border-b border-line-soft-2 last:border-b-0">
                <Avatar initials={`${c.player.firstName[0]}${c.player.lastName[0]}`} size={26} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold">
                    {c.player.firstName} {c.player.lastName}
                  </div>
                  <div className="text-[11.5px] mt-px text-muted">
                    {c.confirmed === true ? "✓ Confirmé" : c.confirmed === false ? "✕ Décliné" : "En attente de réponse"}
                  </div>
                </div>
                <div className="text-xs text-muted">{c.player.position}</div>
                <form action={toggleConvocation.bind(null, match.id, c.playerId)}>
                  <button type="submit" className="h-7 px-2 border border-line rounded-md text-[11px] font-semibold text-red hover:border-red">
                    Retirer
                  </button>
                </form>
              </div>
            ))}
            {squad.some((p) => !convocatedIds.has(p.id)) && (
              <details className="px-3.5 py-2.5">
                <summary className="cursor-pointer text-[12px] font-semibold text-muted hover:text-ink select-none">
                  + Ajouter un joueur (exception)
                </summary>
                <div className="mt-2 flex flex-col gap-1">
                  {squad
                    .filter((p) => !convocatedIds.has(p.id))
                    .map((p) => {
                      const blocked = p.status !== "Actif";
                      return (
                        <form key={p.id} action={blocked ? undefined : toggleConvocation.bind(null, match.id, p.id)}>
                          <button
                            type="submit"
                            disabled={blocked}
                            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left ${blocked ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:bg-bg"}`}
                          >
                            <Avatar initials={p.initials} size={22} />
                            <span className="text-[12px] font-semibold flex-1 truncate">{p.name}</span>
                            <span className={`text-[11px] ${blocked ? "text-red" : "text-muted"}`}>{blocked ? p.status : p.position}</span>
                          </button>
                        </form>
                      );
                    })}
                </div>
              </details>
            )}
          </section>

          <section className="bg-surface border border-line rounded-lg p-3.5">
            <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Convocation</div>
            <div className="font-mono text-[32px] font-bold tracking-[-0.03em] mt-2">
              {convocatedIds.size} <span className="text-base text-muted-2">/ {match.needed}</span>
            </div>
            {convocatedIds.size > 0 && (
              <div className="text-[11.5px] text-muted mt-1.5">
                {confirmedCount} confirmé{confirmedCount > 1 ? "s" : ""} · {declinedCount} décliné{declinedCount > 1 ? "s" : ""} ·{" "}
                {convocatedIds.size - confirmedCount - declinedCount} en attente
              </div>
            )}
            <CopyButton
              text={whatsappText}
              label="Copier le message WhatsApp"
              className="mt-3.5 w-full h-[34px] rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36] cursor-pointer"
            />
            <CopyButton
              text={shareUrl}
              label="Copier le lien de convocation"
              className="mt-2 w-full h-8 border border-line rounded-md bg-surface text-[12.5px] font-semibold text-ink-soft hover:border-ink cursor-pointer"
            />
          </section>
        </div>
      )}

      {tab === "composition" && (
        <CompositionBoard
          matchId={match.id}
          format={match.team.format}
          formation={match.formation}
          slots={Object.fromEntries(
            match.slots.map((s) => [
              s.slotIndex,
              { id: s.player.id, name: `${s.player.firstName} ${s.player.lastName}`, initials: `${s.player.firstName[0]}${s.player.lastName[0]}`, poste: s.player.position },
            ])
          )}
          bench={computeBench(match.convocations, match.slots)
            .map((c) => ({
              id: c.player.id,
              name: `${c.player.firstName} ${c.player.lastName}`,
              initials: `${c.player.firstName[0]}${c.player.lastName[0]}`,
              poste: c.player.position,
            }))}
          nonConvoqued={squad
            .filter((p) => !convocatedIds.has(p.id))
            .map((p) => ({ id: p.id, name: p.name, initials: p.initials, poste: p.position }))}
        />
      )}

      {tab === "feuille" && (
        <div className="flex flex-col gap-3.5">
          {(match.stats.length > 0 || match.convocations.length > 0) && (
            <div className="flex justify-end">
              <Link
                href={`/matchs/${match.id}/imprimer`}
                className="h-8 px-3 border border-line rounded-md text-xs font-semibold text-ink-soft hover:border-ink hover:text-ink"
              >
                Imprimer / Exporter PDF
              </Link>
            </div>
          )}
          <section className="bg-surface border border-line rounded-lg overflow-auto">
            {!played ? (
              <div className="px-4 py-10 text-center text-muted text-[13px]">Le match n&apos;a pas encore été joué.</div>
            ) : match.stats.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-muted text-[13px] mb-3">Aucune feuille de match saisie pour l&apos;instant.</div>
                <form action={generateFeuille.bind(null, match.id)}>
                  <button type="submit" className="h-9 px-4 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
                    Générer la feuille depuis la composition
                  </button>
                </form>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[minmax(160px,1fr)_130px_120px_64px_60px_64px_64px_minmax(140px,1fr)] gap-2.5 items-center px-3.5 h-[34px] bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted">
                  <div>Joueur</div>
                  <div>Poste joué</div>
                  <div>Statut réel</div>
                  <div className="text-right">Min.</div>
                  <div className="text-right">Buts</div>
                  <div className="text-right">Passes</div>
                  <div className="text-right">Note</div>
                  <div>Note individuelle</div>
                </div>
                {match.stats.map((r) => {
                  const positionOptions = POSITIONS.includes(r.position ?? "") || !r.position ? POSITIONS : [r.position, ...POSITIONS];
                  return (
                    <form
                      key={r.id}
                      action={updateStatRow.bind(null, match.id, r.playerId)}
                      className="grid grid-cols-[minmax(160px,1fr)_130px_120px_64px_60px_64px_64px_minmax(140px,1fr)] gap-2.5 items-center px-3.5 h-11 border-b border-line-soft-2 last:border-b-0 text-[12.5px]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar initials={`${r.player.firstName[0]}${r.player.lastName[0]}`} size={24} />
                        <div className="font-semibold truncate">
                          {r.player.firstName} {r.player.lastName}
                        </div>
                      </div>
                      <SelectField name="position" defaultValue={r.position ?? r.player.position} options={positionOptions} />
                      <div className="flex flex-col gap-0.5">
                        <SelectField
                          name="role"
                          defaultValue={r.role}
                          options={MATCH_ROLES}
                          className={`w-full h-7 border border-line rounded text-[11.5px] font-semibold px-1 outline-none focus:border-blue bg-surface ${
                            r.role === "Titulaire" ? "text-green" : "text-muted"
                          }`}
                        />
                        {r.plannedRole !== r.role && <span className="text-[10px] text-muted-2">Prévu : {r.plannedRole}</span>}
                      </div>
                      <NumField name="minutes" defaultValue={r.minutes} />
                      <NumField name="goals" defaultValue={r.goals} />
                      <NumField name="assists" defaultValue={r.assists} />
                      <NumField name="note" defaultValue={r.note ?? ""} step="0.1" />
                      <input
                        name="comment"
                        defaultValue={r.comment ?? ""}
                        placeholder="—"
                        className="h-7 min-w-0 border border-line rounded-md px-2 text-[11.5px] bg-surface outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
                      />
                    </form>
                  );
                })}
              </>
            )}
          </section>

          {played && (
            <section className="bg-surface border border-line rounded-lg p-3.5">
              <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mb-2.5">Bilan du match</div>
              <form action={updateBilan.bind(null, match.id)} className="flex flex-col gap-3">
                {match.preMatchObjective && (
                  <div className="text-[12.5px] text-ink-soft">
                    Objectif fixé : <span className="font-semibold text-ink">{match.preMatchObjective}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12.5px] text-muted mr-1">Objectif :</span>
                  {(
                    [
                      ["ATTEINT", "Atteint"],
                      ["PARTIEL", "Partiellement atteint"],
                      ["NON_ATTEINT", "Non atteint"],
                    ] as const
                  ).map(([v, label]) => (
                    <label key={v} className="flex items-center gap-1.5 text-[12.5px]">
                      <input type="radio" name="objectiveStatus" value={v} defaultChecked={match.objectiveStatus === v} />
                      {label}
                    </label>
                  ))}
                </div>
                <BilanField name="collectiveNote" label="Bilan global" defaultValue={match.collectiveNote} placeholder="Notes collectives sur le match…" />
                <div className="grid grid-cols-2 gap-2.5">
                  <BilanField
                    name="firstHalfNote"
                    label="1ère mi-temps"
                    defaultValue={match.firstHalfNote}
                    placeholder="Ce qui a fonctionné, problèmes rencontrés…"
                  />
                  <BilanField
                    name="secondHalfNote"
                    label="2ème mi-temps"
                    defaultValue={match.secondHalfNote}
                    placeholder="Ce qui a fonctionné, problèmes rencontrés…"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <BilanField
                    name="positivePoints"
                    label="Points positifs"
                    defaultValue={match.positivePoints}
                    placeholder="Ce qu'on veut conserver…"
                  />
                  <BilanField
                    name="improvementAreas"
                    label="Axes d'amélioration"
                    defaultValue={match.improvementAreas}
                    placeholder="Ce qu'on doit retravailler…"
                  />
                </div>
                <BilanField
                  name="notableEvents"
                  label="Faits marquants"
                  defaultValue={match.notableEvents}
                  placeholder="Moment fort, changement tactique, blessure…"
                />
                <button type="submit" className="self-start h-9 px-3 rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
                  Enregistrer le bilan
                </button>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

const matchInputClass =
  "h-9 border border-line rounded-md px-2.5 text-[12.5px] bg-surface outline-none w-full focus:border-blue focus:ring-[3px] focus:ring-blue-bg";

function BilanField({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  placeholder: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        rows={2}
        className="border border-line rounded-md px-2.5 py-2 text-[12.5px] bg-surface outline-none resize-y focus:border-blue focus:ring-[3px] focus:ring-blue-bg"
      />
    </label>
  );
}
