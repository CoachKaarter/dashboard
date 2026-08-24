import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/availability";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { AvailabilityChoice } from "@/components/parent/AvailabilityChoice";
import { setWeekendAvailability, setWeekendAbsenceReason } from "../actions";

const REASONS = ["Maladie", "Famille", "École", "Autre"];
const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const WEEKS_AHEAD = 6;

export default async function ParentMatchsPage() {
  const parent = await requireParentReady();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // MatchConvocation for THIS player is the only source of truth for match
  // visibility — never Match.teamId / parent.player.teamId. The team a
  // child actually plays for on a given Saturday is a sporting decision
  // (WeekendAssignment) the family only learns once the staff has published
  // the convocation.
  const convocations = await prisma.matchConvocation.findMany({
    where: { playerId: parent.playerId, match: { date: { gte: today }, status: { not: "Annulé" } } },
    include: { match: { include: { team: true } } },
    orderBy: { match: { date: "asc" } },
    take: 6,
  });
  const convokedDateKeys = new Set(convocations.map((c) => c.match.date.toISOString().slice(0, 10)));

  // Saturdays with no convocation yet: only ever a generic placeholder —
  // never an adversaire/team, since that isn't decided/communicated to
  // families before publication.
  const saturdays: Date[] = [];
  for (let i = 0; i < WEEKS_AHEAD * 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 6 && !convokedDateKeys.has(d.toISOString().slice(0, 10))) saturdays.push(d);
  }
  const [windows, answers] = await Promise.all([
    prisma.weeklyAvailabilityWindow.findMany({ where: { weekStartDate: { in: saturdays.map((d) => getWeekStart(d)) } } }),
    prisma.playerAvailability.findMany({ where: { playerId: parent.playerId, type: "WEEKEND", eventDate: { in: saturdays } } }),
  ]);
  const windowByWeekStart = new Map(windows.map((w) => [w.weekStartDate.toISOString(), w]));
  const answerByDateKey = new Map(answers.map((a) => [a.eventDate.toISOString().slice(0, 10), a]));

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader title="Matchs à venir" />

      {convocations.length === 0 && saturdays.length === 0 && (
        <ParentCard className="text-center py-8">
          <div className="text-[14px] text-[#6E7178]">Aucun match programmé pour l&apos;instant.</div>
        </ParentCard>
      )}

      {convocations.map((c) => (
        <ParentCard key={c.id}>
          <div className="flex items-start gap-3">
            <div className="w-12 text-center shrink-0">
              <div className="text-[10px] uppercase tracking-[0.06em] text-[#8A8D93]">{DAY_NAMES[c.match.date.getDay()]}</div>
              <div className="text-[19px] font-bold">{c.match.date.getDate()}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold tracking-[0.06em] uppercase text-green">{c.match.team.code}</div>
              <div className="text-[15px] font-bold">
                {c.match.opponent ?? "Adversaire à définir"} {!c.match.isHome && <span className="text-[#9A9DA3] font-medium">(ext.)</span>}
              </div>
              <div className="text-[12.5px] text-[#6E7178] mt-0.5">
                {[c.match.time ? `Coup d'envoi ${c.match.time}` : "Horaire à confirmer", c.match.meetTime ? `RDV ${c.match.meetTime}` : null, c.match.location]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#EFEFEC] text-[13px] font-semibold text-green">
            Convoqué — voir Planning pour confirmer votre présence
          </div>
        </ParentCard>
      ))}

      {saturdays.map((d) => {
        const key = d.toISOString().slice(0, 10);
        const window = windowByWeekStart.get(getWeekStart(d).toISOString());
        const answer = answerByDateKey.get(key);
        const isOpen = window?.status === "OPEN";
        const isLocked = window?.status === "LOCKED";
        const weekStartIso = getWeekStart(d).toISOString();
        return (
          <ParentCard key={key}>
            <div className="flex items-start gap-3">
              <div className="w-12 text-center shrink-0">
                <div className="text-[10px] uppercase tracking-[0.06em] text-[#8A8D93]">{DAY_NAMES[d.getDay()]}</div>
                <div className="text-[19px] font-bold">{d.getDate()}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-bold">Match</div>
                <div className="text-[12.5px] text-[#6E7178] mt-0.5">Informations à venir</div>
              </div>
            </div>
            {isOpen ? (
              <div className="mt-3 pt-3 border-t border-[#EFEFEC]">
                <AvailabilityChoice
                  status={answer?.status as "AVAILABLE" | "UNAVAILABLE" | undefined}
                  onSetStatus={setWeekendAvailability.bind(null, weekStartIso)}
                  presentLabel="Disponible"
                  absentLabel="Indisponible"
                  locked={false}
                  reasons={REASONS}
                  currentReason={answer?.absenceReason ?? undefined}
                  onSetReason={setWeekendAbsenceReason.bind(null, weekStartIso)}
                />
              </div>
            ) : isLocked ? (
              <div className="mt-3 pt-3 border-t border-[#EFEFEC] text-[12.5px] text-[#8A8D93] italic">
                Réponses clôturées{answer ? ` — vous aviez répondu : ${answer.status === "AVAILABLE" ? "disponible" : "indisponible"}` : ""}.
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-[#EFEFEC] text-[12.5px] text-[#8A8D93] italic">
                Disponibilité à venir — le staff n&apos;a pas encore ouvert les réponses pour cette date.
              </div>
            )}
          </ParentCard>
        );
      })}
    </div>
  );
}
