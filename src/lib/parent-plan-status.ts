import type { ParentPlanStatus } from "@/lib/parent-planning";

/**
 * Shared styling for a ParentPlanItem's status — colored left border +
 * status pill, used by /parent/planning and the Accueil "À venir" list so
 * the same event looks the same everywhere in the app.
 */
export const PARENT_PLAN_STATUS_STYLE: Record<ParentPlanStatus, { borderColor: string; chip: string; label: string }> = {
  entrainement: { borderColor: "#3A3D43", chip: "text-[#6E7178] bg-[#F1F1EE]", label: "ENTRAÎNEMENT" },
  annule: { borderColor: "#C4362C", chip: "text-red bg-red-bg", label: "ANNULÉ" },
  aRepondre: { borderColor: "#C4362C", chip: "text-red bg-red-bg", label: "À RÉPONDRE" },
  dispoAVenir: { borderColor: "#3C6E9F", chip: "text-blue bg-blue-bg", label: "DISPO À VENIR" },
  convoque: { borderColor: "#3F8F5B", chip: "text-green bg-green-bg", label: "CONVOQUÉ" },
  neutral: { borderColor: "#3A3D43", chip: "text-[#6E7178] bg-[#F1F1EE]", label: "" },
};
