import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerStatsByTeam } from "@/lib/stats";
import { getSettings } from "@/lib/settings";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { CompositionBoard } from "@/components/CompositionBoard";
import { NumField } from "@/components/ui/NumField";
import { formatDateFull } from "@/lib/format";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { toggleConvocation, recordScore, generateFeuille, updateStatRow } from "../actions";

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

  const [squad, settings] = await Promise.all([getPlayerStatsByTeam(match.team.code), getSettings()]);
  const convocatedIds = new Set(match.convocations.map((c) => c.playerId));

  const played = match.status === "Joué";
  const stage = played ? (match.stats.length > 0 ? 4 : 3) : convocatedIds.size >= match.needed ? 2 : 1;
  const steps = ["Créé", "Convocation", "Composition", "Joué", "Statistiques", "Évaluation"];

  const atRisk = squad.filter((p) => p.status === "Actif" && p.matchsJoues > 0 && p.ecart < -settings.ecartTdj);

  return (
    <div className="max-w-[1500px] mx-auto animate-fadein">
      <Link href="/matchs" className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Tous les matchs
      </Link>

      <div className="bg-surface border border-line rounded-lg px-[18px] py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <TeamChip code={match.team.code} />
          <div className="text-xl font-bold tracking-[-0.02em]">{match.opponent ?? "Adversaire à définir"}</div>
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

        {!played && (
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
              <span className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Effectif disponible</span>
              <span className="flex-1" />
              <span className="text-[11.5px] text-muted-2">Cliquer pour convoquer ou retirer</span>
            </div>
            {squad.map((p) => {
              const on = convocatedIds.has(p.id);
              const blocked = p.status !== "Actif";
              return (
                <form key={p.id} action={blocked ? undefined : toggleConvocation.bind(null, match.id, p.id)}>
                  <button
                    type="submit"
                    disabled={blocked}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 border-b border-line-soft-2 last:border-b-0 text-left ${
                      blocked ? "cursor-not-allowed opacity-55" : "cursor-pointer"
                    }`}
                    style={{ background: on ? "#F4F8F5" : "#FFFFFF" }}
                  >
                    <div
                      className="w-[17px] h-[17px] rounded-[4px] shrink-0 flex items-center justify-center text-[11px] text-white border"
                      style={{ borderColor: on ? "#3F8F5B" : "#D2D2CB", background: on ? "#3F8F5B" : "#FFFFFF" }}
                    >
                      {on ? "✓" : ""}
                    </div>
                    <Avatar initials={p.initials} size={26} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold">{p.name}</div>
                      <div className={`text-[11.5px] mt-px ${blocked ? "text-red" : "text-muted"}`}>
                        {blocked ? p.status : `${Math.round(p.attendanceRate * 100)}% de présence · ${p.minutes} min cette saison`}
                      </div>
                    </div>
                    <div className="text-xs text-muted">{p.position}</div>
                  </button>
                </form>
              );
            })}
          </section>

          <div className="flex flex-col gap-3.5">
            <section className="bg-surface border border-line rounded-lg p-3.5">
              <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">Convocation</div>
              <div className="font-mono text-[32px] font-bold tracking-[-0.03em] mt-2">
                {convocatedIds.size} <span className="text-base text-muted-2">/ {match.needed}</span>
              </div>
              <div className="text-[12.5px] text-muted mt-1">joueurs sélectionnés sur {squad.length} de l&apos;effectif</div>
              <button className="mt-3.5 w-full h-[34px] rounded-md bg-ink text-white text-[12.5px] font-semibold hover:bg-[#2A2E36]">
                Envoyer la convocation
              </button>
              <button className="mt-2 w-full h-8 border border-line rounded-md bg-surface text-[12.5px] font-semibold text-ink-soft hover:border-ink">
                Proposer une sélection
              </button>
            </section>
            {atRisk.length > 0 && (
              <section className="rounded-lg p-3.5" style={{ background: "#FDF3E4", border: "1px solid #F0DFC0" }}>
                <div className="text-[11px] font-bold tracking-[0.11em] uppercase" style={{ color: "#C97A17" }}>
                  À vérifier
                </div>
                <div className="text-[12.5px] mt-2 leading-relaxed" style={{ color: "#6B5A3A" }}>
                  {atRisk.length} joueur{atRisk.length > 1 ? "s" : ""} de l&apos;effectif {atRisk.length > 1 ? "sont" : "est"} sous le seuil de
                  temps de jeu. Le classement rotation les place en priorité pour ce match.
                </div>
                <Link
                  href="/temps-de-jeu"
                  className="inline-block mt-2.5 h-7 px-2.5 leading-7 rounded-md text-xs font-semibold"
                  style={{ border: "1px solid #C97A17", background: "#FFFFFF", color: "#C97A17" }}
                >
                  Voir la rotation
                </Link>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === "composition" && (
        <CompositionBoard
          matchId={match.id}
          formation={match.formation}
          slots={Object.fromEntries(
            match.slots.map((s) => [
              s.slotIndex,
              { id: s.player.id, name: `${s.player.firstName} ${s.player.lastName}`, initials: `${s.player.firstName[0]}${s.player.lastName[0]}`, poste: s.player.position },
            ])
          )}
          bench={match.convocations
            .filter((c) => !match.slots.some((s) => s.playerId === c.playerId))
            .map((c) => ({
              id: c.player.id,
              name: `${c.player.firstName} ${c.player.lastName}`,
              initials: `${c.player.firstName[0]}${c.player.lastName[0]}`,
              poste: c.player.position,
            }))}
        />
      )}

      {tab === "feuille" && (
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
              <div className="grid grid-cols-[minmax(190px,1fr)_130px_100px_76px_70px_78px_78px] gap-3 items-center px-3.5 h-[34px] bg-[#FAFAF8] border-b border-line text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted">
                <div>Joueur</div>
                <div>Poste occupé</div>
                <div>Statut</div>
                <div className="text-right">Minutes</div>
                <div className="text-right">Buts</div>
                <div className="text-right">Passes</div>
                <div className="text-right">Note</div>
              </div>
              {match.stats.map((r) => (
                <form
                  key={r.id}
                  action={updateStatRow.bind(null, match.id, r.playerId)}
                  className="grid grid-cols-[minmax(190px,1fr)_130px_100px_76px_70px_78px_78px] gap-3 items-center px-3.5 h-11 border-b border-line-soft-2 last:border-b-0 text-[12.5px]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar initials={`${r.player.firstName[0]}${r.player.lastName[0]}`} size={24} />
                    <div className="font-semibold truncate">
                      {r.player.firstName} {r.player.lastName}
                    </div>
                  </div>
                  <div className="text-ink-soft">{r.player.position}</div>
                  <div className={`text-[11.5px] font-semibold ${r.role === "Titulaire" ? "text-green" : "text-muted"}`}>{r.role}</div>
                  <NumField name="minutes" defaultValue={r.minutes} />
                  <NumField name="goals" defaultValue={r.goals} />
                  <NumField name="assists" defaultValue={r.assists} />
                  <NumField name="note" defaultValue={r.note ?? ""} step="0.1" />
                </form>
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}
