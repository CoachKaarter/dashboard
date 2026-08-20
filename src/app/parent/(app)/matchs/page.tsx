import { requireParentReady } from "@/lib/parent-guard";
import { prisma } from "@/lib/prisma";
import { getWeekStart, getWindowForWeek } from "@/lib/availability";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { AvailabilityChoice } from "@/components/parent/AvailabilityChoice";
import { setWeekendAvailability, setWeekendAbsenceReason } from "../actions";

const REASONS = ["Maladie", "Famille", "École", "Autre"];
const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

export default async function ParentMatchsPage() {
  const parent = await requireParentReady();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const matches = await prisma.match.findMany({
    where: { teamId: parent.player.teamId, date: { gte: today }, status: { not: "Annulé" } },
    orderBy: { date: "asc" },
    take: 6,
  });

  const rows = await Promise.all(
    matches.map(async (m) => {
      const weekStart = getWeekStart(m.date);
      const weekStartIso = weekStart.toISOString();
      const [window, convocation, answer] = await Promise.all([
        getWindowForWeek(weekStart),
        prisma.matchConvocation.findUnique({ where: { matchId_playerId: { matchId: m.id, playerId: parent.playerId } } }),
        prisma.playerAvailability.findUnique({ where: { playerId_eventDate_type: { playerId: parent.playerId, eventDate: m.date, type: "WEEKEND" } } }),
      ]);
      const isOpen = window?.status === "OPEN";
      const isLocked = window?.status === "LOCKED";
      return { match: m, weekStartIso, isOpen, isLocked, convoked: !!convocation, answer };
    })
  );

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader title="Matchs à venir" />

      {rows.length === 0 && (
        <ParentCard className="text-center py-8">
          <div className="text-[14px] text-[#6E7178]">Aucun match programmé pour l&apos;instant.</div>
        </ParentCard>
      )}

      {rows.map(({ match: m, weekStartIso, isOpen, isLocked, convoked, answer }) => (
        <ParentCard key={m.id}>
          <div className="flex items-start gap-3">
            <div className="w-12 text-center shrink-0">
              <div className="text-[10px] uppercase tracking-[0.06em] text-[#8A8D93]">{DAY_NAMES[m.date.getDay()]}</div>
              <div className="text-[19px] font-bold">{m.date.getDate()}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold tracking-[0.06em] uppercase text-green">U13</div>
              <div className="text-[15px] font-bold">
                {m.opponent ?? "Adversaire à définir"} {!m.isHome && <span className="text-[#9A9DA3] font-medium">(ext.)</span>}
              </div>
              <div className="text-[12.5px] text-[#6E7178] mt-0.5">
                {m.time ? `Coup d'envoi ${m.time}` : "Horaire à confirmer"}
                {m.location ? ` · ${m.location}` : ""}
              </div>
            </div>
          </div>

          {convoked ? (
            <div className="mt-3 pt-3 border-t border-[#EFEFEC] text-[13px] font-semibold text-green">
              ✓ Convoqué — voir Planning pour confirmer votre présence
            </div>
          ) : isOpen ? (
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
      ))}
    </div>
  );
}
