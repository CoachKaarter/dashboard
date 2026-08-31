import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, canAccessTeam } from "@/lib/authz";
import { Avatar } from "@/components/ui/Avatar";
import { NumField } from "@/components/ui/NumField";
import { SelectField } from "@/components/ui/SelectField";
import { formationLabel } from "@/lib/format";
import { POSITIONS } from "@/lib/constants";
import { MATCH_ROLES } from "@/lib/match-validation";
import { ArrowLeftIcon } from "@/components/coach/icons";
import { toggleConvocation, generateFeuille, updateStatRow, recordScore, updateBilan } from "@/app/(app)/matchs/actions";
import { OBJECTIVE_STATUS_LABELS, OBJECTIVE_STATUSES, type ObjectiveStatus } from "@/lib/match-validation";

type Stat = {
  id: string;
  playerId: string;
  player: { firstName: string; lastName: string; position: string };
  plannedRole: string;
  role: string;
  position: string | null;
  minutes: number;
  goals: number;
  assists: number;
  note: number | null;
};

export default async function CoachMatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      team: true,
      convocations: { include: { player: true } },
      slots: true,
      stats: { include: { player: true } },
    },
  });
  if (!match) notFound();
  if (!canAccessTeam(user, match.teamId)) notFound();

  const played = match.status === "Joué";
  const hasStats = match.stats.length > 0;

  return (
    <div className="flex flex-col gap-4 animate-fadein pb-6">
      <Link href="/coach/matchs" className="flex items-center gap-1 text-[13px] font-semibold text-[#6E7178]">
        <ArrowLeftIcon size={16} /> Matchs
      </Link>

      <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4">
        <div className="text-[11px] font-bold tracking-[0.06em] uppercase text-green">{match.team.code}</div>
        <div className="text-[18px] font-bold mt-0.5">{match.opponent ?? "Adversaire à définir"}</div>
        <div className="text-[13px] text-[#6E7178] mt-1">
          {[
            match.time ? `Coup d'envoi ${match.time}` : null,
            match.meetTime ? `RDV ${match.meetTime}${match.meetLocation ? ` (${match.meetLocation})` : ""}` : null,
            match.location,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <div className="text-[12.5px] text-[#9A9DA3] mt-1">Système : {formationLabel(match.formation)}</div>
        {match.preMatchObjective && (
          <div className="text-[12.5px] mt-2 pt-2 border-t border-[#EFEFEC]">
            <span className="text-[#9A9DA3]">Objectif :</span> <span className="font-semibold">{match.preMatchObjective}</span>
          </div>
        )}
      </div>

      {played ? (
        <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4 text-center">
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#9A9DA3]">Score final</div>
          <div className="text-[30px] font-bold font-mono mt-1">
            {match.scoreFor} – {match.scoreAgainst}
          </div>
        </div>
      ) : (
        <form
          action={recordScore.bind(null, match.id)}
          className="bg-white rounded-2xl border border-[#E7E7E2] p-4 flex items-center gap-2.5"
        >
          <span className="text-[13px] font-semibold text-[#6E7178]">Score</span>
          <input
            name="scoreFor"
            type="number"
            min={0}
            required
            className="w-16 h-11 border border-[#E7E7E2] rounded-lg text-center text-[16px] font-bold bg-[#FCFCFB] outline-none focus:border-blue"
          />
          <span className="text-[#9A9DA3] font-bold">–</span>
          <input
            name="scoreAgainst"
            type="number"
            min={0}
            required
            className="w-16 h-11 border border-[#E7E7E2] rounded-lg text-center text-[16px] font-bold bg-[#FCFCFB] outline-none focus:border-blue"
          />
          <button type="submit" className="flex-1 h-11 rounded-lg bg-ink text-white text-[13px] font-semibold active:scale-[0.97] transition-transform duration-100">
            Terminer
          </button>
        </form>
      )}

      {played && (
        <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4 flex flex-col gap-3">
          <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3]">Bilan rapide</div>

          <form action={updateBilan.bind(null, match.id)} className="flex gap-2">
            {OBJECTIVE_STATUSES.map((status) => (
              <button
                key={status}
                type="submit"
                name="objectiveStatus"
                value={status}
                className={`flex-1 h-10 rounded-lg text-[12px] font-semibold active:scale-[0.97] transition-transform duration-100 ${
                  match.objectiveStatus === status ? "bg-ink text-white" : "bg-[#FAFAF8] border border-[#E7E7E2] text-[#6E7178]"
                }`}
              >
                {OBJECTIVE_STATUS_LABELS[status as ObjectiveStatus]}
              </button>
            ))}
          </form>

          <form action={updateBilan.bind(null, match.id)} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#9A9DA3]">Points positifs</span>
              <textarea
                name="positivePoints"
                defaultValue={match.positivePoints ?? ""}
                rows={2}
                className="w-full border border-[#E7E7E2] rounded-lg text-[13px] px-2.5 py-2 bg-[#FCFCFB] outline-none focus:border-blue resize-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#9A9DA3]">Axes d&apos;amélioration</span>
              <textarea
                name="improvementAreas"
                defaultValue={match.improvementAreas ?? ""}
                rows={2}
                className="w-full border border-[#E7E7E2] rounded-lg text-[13px] px-2.5 py-2 bg-[#FCFCFB] outline-none focus:border-blue resize-none"
              />
            </label>
            <button type="submit" className="h-10 rounded-lg bg-ink text-white text-[13px] font-semibold active:scale-[0.97] transition-transform duration-100">
              Enregistrer
            </button>
          </form>
        </div>
      )}

      <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-1">
        Présence ({match.convocations.length} convoqué{match.convocations.length > 1 ? "s" : ""})
      </div>
      {match.convocations.length === 0 && (
        <div className="bg-white rounded-2xl border border-[#E7E7E2] p-4 text-center text-[13px] text-[#6E7178]">
          Aucun joueur convoqué pour l&apos;instant.
        </div>
      )}
      {match.convocations.map((c) => (
        <div key={c.id} className="bg-white rounded-2xl border border-[#E7E7E2] p-3.5 flex items-center gap-2.5">
          <Avatar initials={`${c.player.firstName[0]}${c.player.lastName[0]}`} size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-[14.5px] font-bold truncate">
              {c.player.firstName} {c.player.lastName}
            </div>
            <div className="text-[11.5px] text-[#9A9DA3]">{c.player.position}</div>
          </div>
          <form action={toggleConvocation.bind(null, match.id, c.playerId)}>
            <button
              type="submit"
              className="h-9 px-3 rounded-lg border border-[#E7E7E2] text-[12.5px] font-semibold text-red active:scale-95 transition-transform duration-100"
            >
              Absent
            </button>
          </form>
        </div>
      ))}

      {!hasStats && match.convocations.length > 0 && (
        <form action={generateFeuille.bind(null, match.id)}>
          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-ink text-white text-[14px] font-semibold active:scale-[0.98] transition-transform duration-100"
          >
            Générer la feuille depuis la composition
          </button>
        </form>
      )}

      {hasStats && (
        <>
          <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-1">
            Feuille de match — titulaires/remplaçants, minutes, buts, passes
          </div>
          {match.stats.map((s) => (
            <MatchStatCard key={s.id} matchId={match.id} stat={s} />
          ))}
        </>
      )}
    </div>
  );
}

function MatchStatCard({ matchId, stat }: { matchId: string; stat: Stat }) {
  const positionOptions = POSITIONS.includes(stat.position ?? "") || !stat.position ? POSITIONS : [stat.position, ...POSITIONS];
  const fieldClass = "h-10 border border-[#E7E7E2] rounded-lg text-[13px] px-2 bg-[#FCFCFB] outline-none focus:border-blue w-full";
  return (
    <form action={updateStatRow.bind(null, matchId, stat.playerId)} className="bg-white rounded-2xl border border-[#E7E7E2] p-3.5 flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <Avatar initials={`${stat.player.firstName[0]}${stat.player.lastName[0]}`} size={30} />
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold truncate">
            {stat.player.firstName} {stat.player.lastName}
          </div>
          {stat.plannedRole !== stat.role && <div className="text-[10.5px] text-[#9A9DA3]">Prévu : {stat.plannedRole}</div>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SelectField name="role" defaultValue={stat.role} options={MATCH_ROLES} className={fieldClass} />
        <SelectField name="position" defaultValue={stat.position ?? stat.player.position} options={positionOptions} className={fieldClass} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <LabeledNum label="Min." name="minutes" defaultValue={stat.minutes} />
        <LabeledNum label="Buts" name="goals" defaultValue={stat.goals} />
        <LabeledNum label="Passes" name="assists" defaultValue={stat.assists} />
        <LabeledNum label="Note" name="note" defaultValue={stat.note ?? ""} step="0.1" />
      </div>
    </form>
  );
}

function LabeledNum({ label, name, defaultValue, step }: { label: string; name: string; defaultValue: number | string; step?: string }) {
  return (
    <label className="flex flex-col gap-1 items-center">
      <span className="text-[10px] font-semibold text-[#9A9DA3] uppercase tracking-[0.04em]">{label}</span>
      <NumField name={name} defaultValue={defaultValue} step={step} />
    </label>
  );
}
