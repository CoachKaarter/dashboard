// terminerSeance is the canonical TrainingSession lifecycle closer — kept in
// one place (src/app/(app)/seances/actions.ts) and shared with the desktop
// Cockpit so mobile and desktop can never disagree on when a session becomes
// "Réalisée".
export { terminerSeance } from "@/app/(app)/seances/actions";
