/**
 * Matériel (Cockpit v1.1) — Equipment (l'objet physique) +
 * EquipmentAssignment (un cycle d'attribution/retour, avec historique).
 * Généralisé au-delà des seuls sacs de maillots (spec §8) : MAILLOTS est la
 * seule catégorie réellement outillée aujourd'hui, les autres existent pour
 * que le prochain type de matériel n'exige pas une refonte du modèle.
 *
 * "À attribuer" / "Retour aujourd'hui" / "En retard" ne sont JAMAIS stockés
 * — uniquement dérivés de l'attribution active (s'il y en a une) et de la
 * date du jour, à chaque lecture. Comparaison en calendrier Europe/Paris
 * (src/lib/timezone.ts) — jamais une comparaison naïve de millisecondes,
 * qui serait fausse autour de minuit sur un serveur en UTC.
 */
import { parisStartOfDay } from "@/lib/timezone";

export const EQUIPMENT_CATEGORIES = ["MAILLOTS", "BALLONS", "CHASUBLES", "GOURDES", "CAMERA_VEO", "TROUSSE_MEDICALE", "AUTRE"] as const;
export type EquipmentCategory = (typeof EQUIPMENT_CATEGORIES)[number];

export const EQUIPMENT_CATEGORY_LABELS: Record<string, string> = {
  MAILLOTS: "Sac de maillots",
  BALLONS: "Ballons",
  CHASUBLES: "Chasubles",
  GOURDES: "Gourdes",
  CAMERA_VEO: "Caméra Veo",
  TROUSSE_MEDICALE: "Trousse médicale",
  AUTRE: "Autre matériel",
};

export const TRANSPORT_MODES = ["RDV_SUR_PLACE", "DEPART_COLLECTIF", "COVOITURAGE", "AUTRE"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const TRANSPORT_MODE_LABELS: Record<string, string> = {
  RDV_SUR_PLACE: "Rendez-vous sur place",
  DEPART_COLLECTIF: "Départ collectif",
  COVOITURAGE: "Covoiturage",
  AUTRE: "Autre",
};

// Statuts réellement stockés sur EquipmentAssignment.status.
export const ASSIGNMENT_STATUSES = ["CHEZ_LE_JOUEUR", "RETOUR_SIGNALE_PARENT", "RECUPERE_STAFF"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const CONDITIONS = ["Bon", "À laver", "Abîmé"] as const;

// Statuts affichés (spec §5) — union des statuts stockés + les deux dérivés
// temporels (retour aujourd'hui / en retard) + "à attribuer" (aucune
// attribution active).
export type EquipmentDisplayStatus = "A_ATTRIBUER" | "CHEZ_LE_JOUEUR" | "RETOUR_AUJOURD_HUI" | "EN_RETARD" | "RETOUR_SIGNALE_PARENT" | "RECUPERE_STAFF";

export const DISPLAY_STATUS_LABELS: Record<EquipmentDisplayStatus, string> = {
  A_ATTRIBUER: "À attribuer",
  CHEZ_LE_JOUEUR: "Chez le joueur",
  RETOUR_AUJOURD_HUI: "Retour aujourd'hui",
  EN_RETARD: "En retard",
  RETOUR_SIGNALE_PARENT: "Retour signalé par le parent",
  RECUPERE_STAFF: "Récupéré par le staff",
};

// Code couleur (spec §6) : orange = retour prévu aujourd'hui, rouge = en
// retard, bleu/neutre = confié, vert = récupéré. "Retour signalé" est
// traité comme une action à traiter (orange), pas encore "réglé" (vert).
export const DISPLAY_STATUS_TONE: Record<EquipmentDisplayStatus, "red" | "orange" | "blue" | "green" | "neutral"> = {
  A_ATTRIBUER: "neutral",
  CHEZ_LE_JOUEUR: "blue",
  RETOUR_AUJOURD_HUI: "orange",
  EN_RETARD: "red",
  RETOUR_SIGNALE_PARENT: "orange",
  RECUPERE_STAFF: "green",
};

// Un matériel lié à une équipe (ex. sac de maillots U13A) reste
// sélectionnable pour n'importe quel joueur de la même CATÉGORIE, pas
// seulement les joueurs administrativement rattachés à cette équipe
// précise — même principe qu'assertPlayerOnMatchTeam (matchs/actions.ts)
// et playerInSessionCategory (session-expectation.ts) : un U13B qui prend
// le relais du lavage des maillots U13A doit pouvoir être sélectionné.
// Matériel non lié à une équipe (teamId null) : tous les joueurs.
export function playerMatchesEquipmentCategory(equipmentTeam: { category: string } | null, player: { team: { category: string } }): boolean {
  if (!equipmentTeam) return true;
  return player.team.category === equipmentTeam.category;
}

export type EquipmentAssignmentLike = { status: string; dueDate: Date };

/**
 * `active` = la dernière attribution de cet équipement dont le statut
 * n'est pas RECUPERE_STAFF (ou null s'il n'y en a aucune / la dernière est
 * déjà récupérée) — c'est à l'appelant de la sélectionner (une seule
 * requête, triée par createdAt desc, jamais recalculé ici).
 */
export function computeEquipmentDisplayStatus(active: EquipmentAssignmentLike | null, now: Date): EquipmentDisplayStatus {
  if (!active) return "A_ATTRIBUER";
  if (active.status === "RETOUR_SIGNALE_PARENT") return "RETOUR_SIGNALE_PARENT";
  if (active.status === "RECUPERE_STAFF") return "RECUPERE_STAFF"; // défensif — ne devrait pas être passé comme "active"

  const today = parisStartOfDay(now).getTime();
  const due = parisStartOfDay(active.dueDate).getTime();
  if (due === today) return "RETOUR_AUJOURD_HUI";
  if (due < today) return "EN_RETARD";
  return "CHEZ_LE_JOUEUR";
}

/** Nombre de jours de retard (0 si pas en retard) — pour l'affichage "+3 j.". */
export function daysLate(active: EquipmentAssignmentLike, now: Date): number {
  const today = parisStartOfDay(now).getTime();
  const due = parisStartOfDay(active.dueDate).getTime();
  return due < today ? Math.round((today - due) / 86400000) : 0;
}
