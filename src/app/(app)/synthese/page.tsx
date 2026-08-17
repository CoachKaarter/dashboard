import Link from "next/link";
import { requireUser, scopedTeamIds } from "@/lib/authz";
import { getTodayDigest, getWeekendRecap, getWeekRecap } from "@/lib/synthese";
import { TeamChip } from "@/components/ui/TeamChip";
import { Badge } from "@/components/ui/Badge";
import { formatDateFull, formatDateShort } from "@/lib/format";

const RESULT_TONE: Record<string, "green" | "orange" | "red"> = { V: "green", N: "orange", D: "red" };

export default async function SynthesePage() {
  const user = await requireUser();
  const scope = scopedTeamIds(user);

  const [today, weekend, week] = await Promise.all([
    getTodayDigest(scope),
    getWeekendRecap(scope),
    getWeekRecap(scope),
  ]);

  return (
    <div className="max-w-[1100px] mx-auto animate-fadein flex flex-col gap-4">
      <section className="bg-surface border border-line rounded-lg p-4">
        <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mb-2.5">
          Ce qui demande ton attention aujourd&apos;hui
        </div>
        {today.priorityAlerts.length === 0 && today.sessions.length === 0 && today.matches.length === 0 ? (
          <div className="text-[12.5px] text-muted-2 py-2">Rien de particulier aujourd&apos;hui.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {today.priorityAlerts.slice(0, 6).map((a) => (
              <Link key={a.key} href={a.href} className="flex items-center gap-2.5 py-1.5 hover:bg-[#FAFAF8] -mx-1.5 px-1.5 rounded-md">
                <TeamChip code={a.tag} />
                <span className="text-[12.5px] font-medium flex-1 truncate">{a.title}</span>
              </Link>
            ))}
            {today.sessions.map((s) => (
              <Link key={s.id} href={`/seances/${s.id}`} className="flex items-center gap-2.5 py-1.5 hover:bg-[#FAFAF8] -mx-1.5 px-1.5 rounded-md">
                <TeamChip code={s.scopeTeam?.code ?? s.category} />
                <span className="text-[12.5px] font-medium flex-1">{s.label} — {s.startTime}</span>
                <Badge tone="blue">Séance</Badge>
              </Link>
            ))}
            {today.matches.map((m) => (
              <Link key={m.id} href={`/matchs/${m.id}`} className="flex items-center gap-2.5 py-1.5 hover:bg-[#FAFAF8] -mx-1.5 px-1.5 rounded-md">
                <TeamChip code={m.team.code} />
                <span className="text-[12.5px] font-medium flex-1">
                  vs {m.opponent ?? "adversaire à définir"} — {m.convocations.length}/{m.needed} convoqués
                </span>
                <Badge tone="purple">Match</Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4">
        <section className="bg-surface border border-line rounded-lg p-4">
          <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mb-2.5">Le week-end dernier</div>
          {weekend.length === 0 ? (
            <div className="text-[12.5px] text-muted-2 py-2">Aucun match joué ces 7 derniers jours.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {weekend.map((m) => (
                <div key={m.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <TeamChip code={m.teamCode} />
                    <span className="text-[12.5px] font-semibold flex-1 truncate">vs {m.opponent}</span>
                    {m.result && <Badge tone={RESULT_TONE[m.result]}>{m.result}</Badge>}
                    <span className="font-mono text-[13px] font-bold">{m.scoreFor} – {m.scoreAgainst}</span>
                  </div>
                  {m.scorers.length > 0 && (
                    <div className="text-[11.5px] text-muted pl-1">
                      Buteurs : {m.scorers.map((s) => `${s.name}${s.goals > 1 ? ` (${s.goals})` : ""}`).join(", ")}
                    </div>
                  )}
                  <div className="text-[10.5px] text-muted-2 pl-1">{formatDateFull(m.date)}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-surface border border-line rounded-lg p-4">
          <div className="text-[11px] font-bold tracking-[0.11em] uppercase text-muted mb-2.5">Cette semaine</div>
          {week.sessionsCount === 0 ? (
            <div className="text-[12.5px] text-muted-2 py-2">Aucune séance pointée ces 7 derniers jours.</div>
          ) : (
            <>
              <div className="flex gap-4 mb-2.5">
                <div>
                  <div className="font-mono text-[19px] font-bold">{week.sessionsCount}</div>
                  <div className="text-[10px] text-muted uppercase tracking-[0.06em]">Séances pointées</div>
                </div>
                <div>
                  <div className="font-mono text-[19px] font-bold">{week.attendanceRate ?? "—"}%</div>
                  <div className="text-[10px] text-muted uppercase tracking-[0.06em]">Présence moyenne</div>
                </div>
                <div>
                  <div className="font-mono text-[19px] font-bold text-red">{week.totalANJ}</div>
                  <div className="text-[10px] text-muted uppercase tracking-[0.06em]">Absences non just.</div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {week.sessions.map((s) => (
                  <Link key={s.id} href={`/seances/${s.id}`} className="flex items-center gap-2 py-1 hover:bg-[#FAFAF8] -mx-1.5 px-1.5 rounded-md">
                    <TeamChip code={s.scopeTeam?.code ?? s.category} />
                    <span className="text-[11.5px] text-muted flex-1">{formatDateShort(s.date)} — {s.label}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
