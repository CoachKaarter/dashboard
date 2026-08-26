import Link from "next/link";
import { requireParentReady } from "@/lib/parent-guard";
import { getParentHomeState } from "@/lib/parent-home";
import { setSessionAvailability, setSessionAbsenceReason, setWeekendAvailability, setWeekendAbsenceReason } from "./actions";
import { ParentHeader } from "@/components/parent/ParentHeader";
import { ParentCard } from "@/components/parent/ParentCard";
import { ParentTaskCard } from "@/components/parent/ParentTaskCard";
import { AvailabilityChoice } from "@/components/parent/AvailabilityChoice";
import { HeroCard } from "@/components/parent/HeroCard";
import { UpcomingList } from "@/components/parent/UpcomingList";
import { WeekStrip } from "@/components/parent/WeekStrip";
import { SuiviSection } from "@/components/parent/SuiviSection";

const REASONS = ["Maladie", "Famille", "École", "Autre"];
const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function fmtDay(d: Date) {
  return `${DAY_NAMES[d.getDay()][0].toUpperCase()}${DAY_NAMES[d.getDay()].slice(1)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function dateParam(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * Accueil Parent v2 — HEADER → MAINTENANT (un seul Hero) → À VENIR →
 * CETTE SEMAINE → SUIVI. Toute la décision "qu'est-ce qui compte
 * maintenant" vit dans src/lib/parent-priority.ts (moteur de priorité) et
 * src/lib/parent-home.ts (assemblage des signaux) — cette page ne fait
 * qu'afficher leur résultat, jamais de `if` de priorité ici. Le formulaire
 * de réponse aux disponibilités reste juste sous le Hero (id="dispos", cible
 * de son CTA) : c'est l'endroit où on agit, le Hero dit seulement quoi
 * faire — jamais l'écran entier comme avant.
 */
export default async function ParentAccueilPage() {
  const parent = await requireParentReady();
  const state = await getParentHomeState(parent);
  const todayKey = dateParam(new Date());

  return (
    <div className="flex flex-col gap-5 animate-fadein">
      <ParentHeader firstName={state.firstName} category={state.category} subtitle={state.weekLabel} clubName={state.clubName} />

      {state.hero ? (
        <HeroCard card={state.hero} />
      ) : state.upcoming[0] ? (
        <ParentCard>
          <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-[#8A8D93]">Prochain rendez-vous</div>
          <div className="text-[16px] font-bold mt-1">
            {fmtDay(state.upcoming[0].date)} · {state.upcoming[0].label}
          </div>
          {state.upcoming[0].sub && <div className="text-[13px] text-[#6E7178] mt-0.5">{state.upcoming[0].sub}</div>}
        </ParentCard>
      ) : (
        <ParentCard className="text-center py-6">
          <div className="text-[14px] text-[#6E7178]">Aucun rendez-vous prévu pour le moment.</div>
        </ParentCard>
      )}

      {state.availabilityForm && (
        <div id="dispos" className="flex flex-col gap-2.5 scroll-mt-6">
          <div className="text-[11px] font-bold tracking-[0.09em] uppercase text-[#9A9DA3] mt-1">Compléter mes disponibilités</div>
          {state.availabilityForm.sessions.map((s) => (
            <ParentTaskCard key={s.id} kicker={fmtDay(s.date)} title="Entraînement" detail={`${s.startTime} → ${s.endTime} · ${s.location}`}>
              {state.availabilityForm!.isBeforeOpen ? (
                <div className="text-[13px] text-[#8A8D93] italic">Réponse pas encore possible.</div>
              ) : (
                <AvailabilityChoice
                  status={s.answer as "AVAILABLE" | "UNAVAILABLE" | undefined}
                  onSetStatus={setSessionAvailability.bind(null, s.id)}
                  locked={state.availabilityForm!.isLocked}
                  reasons={REASONS}
                  currentReason={s.absenceReason}
                  onSetReason={setSessionAbsenceReason.bind(null, s.id)}
                />
              )}
            </ParentTaskCard>
          ))}
          {!state.availabilityForm.weekendConvocation && (
            <ParentTaskCard kicker="Ce week-end" title="Disponibilité du samedi" detail="Ton enfant est-il disponible pour jouer ce week-end ?">
              {state.availabilityForm.isBeforeOpen ? (
                <div className="text-[13px] text-[#8A8D93] italic">Réponse pas encore possible.</div>
              ) : (
                <AvailabilityChoice
                  status={state.availabilityForm.weekendAnswer?.status as "AVAILABLE" | "UNAVAILABLE" | undefined}
                  onSetStatus={setWeekendAvailability.bind(null, state.availabilityForm.weekStartIso)}
                  presentLabel="Disponible"
                  absentLabel="Indisponible"
                  locked={state.availabilityForm.isLocked}
                  reasons={REASONS}
                  currentReason={state.availabilityForm.weekendAnswer?.absenceReason}
                  onSetReason={setWeekendAbsenceReason.bind(null, state.availabilityForm.weekStartIso)}
                />
              )}
            </ParentTaskCard>
          )}
        </div>
      )}

      <UpcomingList items={state.upcoming} />

      <WeekStrip days={state.weekStrip} todayKey={todayKey} />

      <SuiviSection firstName={state.firstName} objective={state.suivi.objective} feedback={state.suivi.feedback} />

      <div className="text-center pb-1">
        <Link href="/parent/infos" className="text-[12.5px] font-semibold text-[#8A8D93] underline underline-offset-2">
          Informations du club
        </Link>
      </div>
    </div>
  );
}
