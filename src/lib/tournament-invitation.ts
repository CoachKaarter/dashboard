/**
 * Invitation reçue d'un autre club à participer à un tournoi — décision du
 * staff (accepter/refuser) distincte du match lui-même. Ne jamais fusionner
 * avec Match (la réalité qui se joue une fois créée) ni avec
 * CalendarEvent.kind === "tournoi" (simple événement d'agenda, sans
 * workflow de décision) — voir prisma/schema.prisma pour le détail.
 */
import { parisStartOfDay } from "@/lib/timezone";

export const STATUS_LABEL: Record<string, string> = {
  EN_ATTENTE: "À traiter",
  ACCEPTEE: "Acceptée",
  REFUSEE: "Refusée",
};

export const STATUS_TONE: Record<string, "orange" | "green" | "red"> = {
  EN_ATTENTE: "orange",
  ACCEPTEE: "green",
  REFUSEE: "red",
};

/** Pure — vrai si la date limite de réponse tombe dans les `withinDays` jours à venir (ou est déjà dépassée). */
export function isDeadlineSoon(deadline: Date | null, now: Date, withinDays = 3): boolean {
  if (!deadline) return false;
  const today = parisStartOfDay(now).getTime();
  const d = parisStartOfDay(deadline).getTime();
  const daysLeft = Math.round((d - today) / 86400000);
  return daysLeft <= withinDays;
}

/** Pure — vrai si la date limite de réponse est strictement dans le passé. */
export function isDeadlinePassed(deadline: Date | null, now: Date): boolean {
  if (!deadline) return false;
  return parisStartOfDay(deadline).getTime() < parisStartOfDay(now).getTime();
}

export type InvitationForMatch = {
  id: string;
  organizingClub: string;
  date: Date;
  location: string | null;
};

export type TeamForMatch = {
  id: string;
  category: string;
};

/**
 * Pure — les champs Match.create à partir d'une invitation acceptée et de
 * l'équipe choisie. `needed` suit la même heuristique catégorie que
 * src/lib/weekend.ts (12 en U13, 11 sinon) — pas de champ dédié sur Team
 * pour ça, donc pas de nouvelle source de vérité inventée ici.
 */
export function matchDataFromInvitation(invitation: InvitationForMatch, team: TeamForMatch) {
  return {
    teamId: team.id,
    opponent: invitation.organizingClub,
    competition: "Tournoi",
    date: invitation.date,
    location: invitation.location,
    isHome: false,
    status: "Planifié",
    needed: team.category === "U13" ? 12 : 11,
    tournamentInvitationId: invitation.id,
  };
}
