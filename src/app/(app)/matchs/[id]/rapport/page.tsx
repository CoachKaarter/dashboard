import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { TeamChip } from "@/components/ui/TeamChip";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type Tone } from "@/components/ui/Badge";
import { formatDateFull, formationLabel } from "@/lib/format";
import { computeMatchResult, computeGoalDifference, RESULT_LABEL_FR } from "@/lib/match-phase";
import { OBJECTIVE_STATUS_LABELS, type ObjectiveStatus } from "@/lib/match-validation";

const RESULT_TONE: Record<"GAGNE" | "NUL" | "PERDU", Tone> = { GAGNE: "green", NUL: "neutral", PERDU: "red" };

export default async function MatchRapportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      team: true,
      stats: { include: { player: true }, orderBy: [{ role: "asc" }, { player: { lastName: "asc" } }] },
      plateauResults: { orderBy: { order: "asc" } },
    },
  });
  if (!match) notFound();
  if (!canAccessTeam(user, match.teamId)) notFound();

  const played = match.status === "Joué";
  const isPlateau = match.competition === "Plateau";
  const result = played && !isPlateau ? computeMatchResult(match.scoreFor!, match.scoreAgainst!) : null;
  const goalDiff = played && !isPlateau ? computeGoalDifference(match.scoreFor!, match.scoreAgainst!) : null;
  const starters = match.stats.filter((s) => s.role === "Titulaire");
  const bench = match.stats.filter((s) => s.role === "Remplaçant");

  const hasAvantMatch = match.preMatchObjective || match.mainInstructions || match.preMatchNotes;
  const hasMiTemps = match.firstHalfNote || match.secondHalfNote;
  const hasAnalyse = match.objectiveStatus || match.collectiveNote || match.positivePoints || match.improvementAreas || match.notableEvents;

  return (
    <div className="max-w-[900px] mx-auto animate-fadein">
      <Link href={`/matchs/${id}?tab=feuille`} className="text-muted text-xs hover:text-ink inline-block pb-2.5">
        ← Retour au match
      </Link>

      <div className="bg-surface border border-line rounded-lg px-[18px] py-4">
        <div className="flex items-center gap-3 flex-wrap">
          <TeamChip code={match.team.code} />
          <div className="text-xl font-bold tracking-[-0.02em]">{isPlateau ? "Plusieurs équipes" : (match.opponent ?? "Adversaire à définir")}</div>
          {match.status === "Annulé" && <Badge tone="red">Annulé</Badge>}
          {result && <Badge tone={RESULT_TONE[result]}>{RESULT_LABEL_FR[result]}</Badge>}
          <span className="flex-1" />
          {played && !isPlateau && (
            <div className="font-mono text-2xl font-bold">
              {match.scoreFor} – {match.scoreAgainst}
            </div>
          )}
        </div>
        <div className="text-muted text-[12.5px] mt-[5px]">
          {formatDateFull(match.date)} · {match.competition} · {match.isHome ? "Domicile" : "Extérieur"} · {match.location ?? "lieu à définir"} · Système{" "}
          {formationLabel(match.formation)}
        </div>
        {played && goalDiff !== null && (
          <div className="text-[12.5px] mt-1 text-muted">
            Différence de buts : <span className={`font-semibold ${goalDiff > 0 ? "text-green" : goalDiff < 0 ? "text-red" : "text-ink"}`}>{goalDiff > 0 ? `+${goalDiff}` : goalDiff}</span>
          </div>
        )}
        {match.competition === "Tournoi" && match.tournamentRanking && match.tournamentTeamsCount && (
          <div className="text-[12.5px] mt-1">
            <span className="text-muted-2">Classement tournoi :</span>{" "}
            <span className="font-semibold">
              {match.tournamentRanking}e / {match.tournamentTeamsCount} équipes
            </span>
          </div>
        )}
        {isPlateau && (
          <div className="mt-3 pt-3 border-t border-line-soft-2 flex flex-col gap-1.5">
            {match.plateauResults.length === 0 ? (
              <span className="text-[12.5px] text-muted">Aucune rencontre saisie.</span>
            ) : (
              match.plateauResults.map((r) => {
                const rResult = r.scoreFor !== null && r.scoreAgainst !== null ? computeMatchResult(r.scoreFor, r.scoreAgainst) : null;
                return (
                  <div key={r.id} className="flex items-center gap-2.5 text-[12.5px]">
                    {rResult ? <Badge tone={RESULT_TONE[rResult]}>{RESULT_LABEL_FR[rResult]}</Badge> : <Badge tone="neutral">—</Badge>}
                    <span className="font-semibold">{r.opponent}</span>
                    <span className="flex-1" />
                    <span className="font-mono font-bold">{r.scoreFor ?? "—"} – {r.scoreAgainst ?? "—"}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {hasAvantMatch && (
        <Section title="Avant-match">
          {match.preMatchObjective && <Field label="Objectif" value={match.preMatchObjective} />}
          {match.mainInstructions && <Field label="Consignes" value={match.mainInstructions} />}
          {match.preMatchNotes && <Field label="Notes" value={match.preMatchNotes} />}
        </Section>
      )}

      {hasAnalyse && (
        <Section title="Analyse collective">
          {match.objectiveStatus && (
            <Field label="Objectif" value={OBJECTIVE_STATUS_LABELS[match.objectiveStatus as ObjectiveStatus]} />
          )}
          {match.collectiveNote && <Field label="Bilan global" value={match.collectiveNote} />}
          {hasMiTemps && (
            <div className="grid grid-cols-2 gap-3.5">
              {match.firstHalfNote && <Field label="1ère mi-temps" value={match.firstHalfNote} />}
              {match.secondHalfNote && <Field label="2ème mi-temps" value={match.secondHalfNote} />}
            </div>
          )}
          {(match.positivePoints || match.improvementAreas) && (
            <div className="grid grid-cols-2 gap-3.5">
              {match.positivePoints && <Field label="Points positifs" value={match.positivePoints} />}
              {match.improvementAreas && <Field label="Axes de progression" value={match.improvementAreas} />}
            </div>
          )}
          {match.notableEvents && <Field label="Faits marquants" value={match.notableEvents} />}
        </Section>
      )}

      {match.stats.length > 0 && (
        <Section title="Joueurs">
          <PlayersTable title={`Titulaires (${starters.length})`} rows={starters} />
          <PlayersTable title={`Remplaçants (${bench.length})`} rows={bench} />
        </Section>
      )}

      {!hasAvantMatch && !hasAnalyse && match.stats.length === 0 && (
        <div className="bg-surface border border-line rounded-lg mt-3.5 px-4 py-10 text-center text-muted text-[13px]">
          Rien à afficher pour l&apos;instant — le rapport se remplit automatiquement à mesure que le match avance.
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-lg mt-3.5 px-[18px] py-4 flex flex-col gap-3">
      <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted-2">{label}</div>
      <div className="text-[13px] mt-0.5 whitespace-pre-wrap">{value}</div>
    </div>
  );
}

type PlayerRow = {
  id: string;
  player: { firstName: string; lastName: string };
  position: string | null;
  minutes: number;
  goals: number;
  assists: number;
  note: number | null;
  comment: string | null;
};

function PlayersTable({ title, rows }: { title: string; rows: PlayerRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted-2 mb-1.5">{title}</div>
      <div className="border border-line-soft-2 rounded-md overflow-hidden">
        <div className="grid grid-cols-[minmax(140px,1fr)_100px_50px_50px_50px_50px_minmax(120px,1fr)] gap-2 items-center px-3 h-8 bg-[#FAFAF8] border-b border-line-soft-2 text-[10px] font-bold tracking-[0.06em] uppercase text-muted">
          <div>Joueur</div>
          <div>Poste</div>
          <div className="text-right">Min.</div>
          <div className="text-right">Buts</div>
          <div className="text-right">Passes</div>
          <div className="text-right">Note</div>
          <div>Commentaire</div>
        </div>
        {rows.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[minmax(140px,1fr)_100px_50px_50px_50px_50px_minmax(120px,1fr)] gap-2 items-center px-3 h-10 border-b border-line-soft-2 last:border-b-0 text-[12.5px]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Avatar initials={`${r.player.firstName[0]}${r.player.lastName[0]}`} size={22} />
              <span className="font-semibold truncate">
                {r.player.firstName} {r.player.lastName}
              </span>
            </div>
            <div className="text-muted">{r.position ?? "—"}</div>
            <div className="text-right font-mono">{r.minutes || "—"}</div>
            <div className="text-right font-mono">{r.goals || "—"}</div>
            <div className="text-right font-mono">{r.assists || "—"}</div>
            <div className="text-right font-mono">{r.note ?? "—"}</div>
            <div className="text-muted truncate">{r.comment ?? "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
