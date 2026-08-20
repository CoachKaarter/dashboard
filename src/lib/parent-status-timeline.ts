/**
 * Espace Parents redesign — "Où en est [prénom] pour samedi ?" status
 * tracker on the parent Accueil screen. Visualizes the exact same pipeline
 * built server-side this session: PlayerAvailability (WEEKEND) →
 * WeekendAssignment → WeekendPlan.status → MatchConvocation. Never a new
 * source of truth — purely a read-only projection of those four models.
 *
 * Pure function so the step sequencing is directly testable without a
 * live database.
 */
export type WeekendTimelineInput = {
  answered: "AVAILABLE" | "UNAVAILABLE" | null;
  selectionStarted: boolean; // a WeekendPlan exists and isn't DRAFT, or a WeekendAssignment exists for this player
  convoked: boolean; // a MatchConvocation exists for this player for the resolved match
  convokedTeamCode: string | null;
};

export type WeekendTimelineStep = {
  key: "requested" | "answered" | "selection" | "convoked";
  title: string;
  detail: string;
  done: boolean;
  current: boolean;
};

export function computeWeekendTimeline(input: WeekendTimelineInput): WeekendTimelineStep[] {
  const { answered, selectionStarted, convoked, convokedTeamCode } = input;

  const steps: Omit<WeekendTimelineStep, "done" | "current">[] = [
    { key: "requested", title: "Disponibilité demandée", detail: "Demandée par le staff" },
    {
      key: "answered",
      title: answered ? `Vous avez répondu : ${answered === "AVAILABLE" ? "disponible" : "indisponible"}` : "Votre réponse",
      detail: answered ? "Réponse enregistrée" : "En attente de votre réponse",
    },
    { key: "selection", title: "Sélection en cours", detail: "Le staff répartit les joueurs dans les équipes" },
    {
      key: "convoked",
      title: convoked && convokedTeamCode ? `Convoqué en ${convokedTeamCode}` : "Convocation",
      detail: convoked ? "Convocation publiée" : "Dès que la sélection est faite",
    },
  ];

  const doneFlags = [true, answered !== null, selectionStarted, convoked];
  // "current" = the most recently completed step ("we are here"), not the
  // next action needed — matches the design: step 1 is highlighted the
  // instant the request opens, before the parent has done anything.
  let currentIndex = 0;
  for (let i = 0; i < doneFlags.length; i++) if (doneFlags[i]) currentIndex = i;

  return steps.map((s, i) => ({ ...s, done: doneFlags[i], current: i === currentIndex }));
}
