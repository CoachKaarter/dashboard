import Link from "next/link";
import { requireParentReady } from "@/lib/parent-guard";
import { getParentPlanItems } from "@/lib/parent-planning";
import { ParentPageHeader } from "@/components/parent/ParentPageHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { AvailabilityChoice } from "@/components/parent/AvailabilityChoice";
import { CheckIcon, XIcon, ChevronRightIcon } from "@/components/parent/icons";
import { setWeekendAvailability, setWeekendAbsenceReason } from "../actions";
import { confirmMyConvocation } from "../planning/actions";

const REASONS = ["Maladie", "Famille", "École", "Autre"];
const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const WEEKS_AHEAD = 6;

export default async function ParentMatchsPage() {
  const parent = await requireParentReady();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = new Date(today);
  to.setDate(to.getDate() + WEEKS_AHEAD * 7);

  // Even source (getParentPlanItems) as Planning : la visibilité d'un match
  // dépend uniquement de MatchConvocation pour ce joueur, jamais de
  // Player.teamId. Filtré ici aux seuls samedis (convoqués ou non).
  const items = (await getParentPlanItems(parent, today, to)).filter((it) => it.kind === "weekend" || it.kind === "convocation");

  return (
    <div className="flex flex-col gap-4 animate-fadein">
      <ParentPageHeader title="Rencontres à venir" />

      {items.length === 0 && (
        <ParentCard className="text-center py-8">
          <div className="text-[14px] text-[#6E7178]">Aucune rencontre programmée pour l&apos;instant.</div>
        </ParentCard>
      )}

      {items.map((it, i) => (
        <ParentCard key={i}>
          {it.kind === "convocation" && it.matchId ? (
            <Link href={`/parent/matchs/${it.matchId}`} className="flex items-start gap-3 -m-0.5 p-0.5 rounded-lg active:opacity-70">
              <div className="w-12 text-center shrink-0">
                <div className="text-[10px] uppercase tracking-[0.06em] text-[#8A8D93]">{DAY_NAMES[it.date.getDay()]}</div>
                <div className="text-[19px] font-bold">{it.date.getDate()}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold tracking-[0.07em] uppercase text-club-primary">{it.label}</div>
                <div className="text-[12.5px] text-[#6E7178] mt-0.5">{it.sub}</div>
              </div>
              <ChevronRightIcon size={16} className="text-[#C9CBC7] shrink-0 mt-1" />
            </Link>
          ) : (
            <div className="flex items-start gap-3">
              <div className="w-12 text-center shrink-0">
                <div className="text-[10px] uppercase tracking-[0.06em] text-[#8A8D93]">{DAY_NAMES[it.date.getDay()]}</div>
                <div className="text-[19px] font-bold">{it.date.getDate()}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold tracking-[0.07em] uppercase text-[#9A9DA3]">{it.label}</div>
                <div className="text-[12.5px] text-[#6E7178] mt-0.5">{it.sub}</div>
              </div>
            </div>
          )}

          {it.kind === "convocation" && it.matchId ? (
            <div className="mt-3 pt-3 border-t border-[#EFEFEC] flex gap-1.5">
              <form action={confirmMyConvocation.bind(null, it.matchId, true)} className="flex-1">
                <button
                  type="submit"
                  className={`w-full h-9 px-3 rounded-lg text-[12px] font-bold border-2 inline-flex items-center justify-center gap-1 active:scale-95 transition-all duration-150 ${
                    it.confirmed === true ? "bg-green border-green text-white" : "bg-white border-[#E7E7E2] text-green"
                  }`}
                >
                  <CheckIcon size={14} /> Je viens
                </button>
              </form>
              <form action={confirmMyConvocation.bind(null, it.matchId, false)} className="flex-1">
                <button
                  type="submit"
                  className={`w-full h-9 px-3 rounded-lg text-[12px] font-bold border-2 inline-flex items-center justify-center gap-1 active:scale-95 transition-all duration-150 ${
                    it.confirmed === false ? "bg-red border-red text-white" : "bg-white border-[#E7E7E2] text-red"
                  }`}
                >
                  <XIcon size={14} /> Absent
                </button>
              </form>
            </div>
          ) : it.windowStatus === "OPEN" ? (
            <div className="mt-3 pt-3 border-t border-[#EFEFEC]">
              <AvailabilityChoice
                status={it.answer as "AVAILABLE" | "UNAVAILABLE" | undefined}
                onSetStatus={setWeekendAvailability.bind(null, it.weekStartIso!)}
                presentLabel="Disponible"
                absentLabel="Indisponible"
                locked={false}
                reasons={REASONS}
                currentReason={undefined}
                onSetReason={setWeekendAbsenceReason.bind(null, it.weekStartIso!)}
              />
            </div>
          ) : it.windowStatus === "LOCKED" ? (
            <div className="mt-3 pt-3 border-t border-[#EFEFEC] text-[12.5px] text-[#8A8D93] italic">
              Réponses clôturées{it.answer ? ` — vous aviez répondu : ${it.answer === "AVAILABLE" ? "disponible" : "indisponible"}` : ""}.
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
