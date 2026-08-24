import { z } from "zod";
import { FORMATIONS, FORMATIONS_BY_FORMAT } from "@/lib/constants";

export function isValidFormation(format: string, formation: string): boolean {
  const allowed = FORMATIONS_BY_FORMAT[format] ?? FORMATIONS_BY_FORMAT["Foot à 8"];
  return allowed.includes(formation);
}

export function isValidSlotIndex(formation: string, slotIndex: number): boolean {
  const positions = FORMATIONS[formation] ?? FORMATIONS["1-3-3-1"];
  return Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < positions.length;
}

// Bounds are deliberately generous — this validates against fat-fingering
// and tampered form submissions, not against unusual-but-real results
// (a 12-0 youth friendly, a 90-minute U13 tournament final, etc.).
export const scoreSchema = z.object({
  scoreFor: z.number().int().min(0).max(50),
  scoreAgainst: z.number().int().min(0).max(50),
});

export const MATCH_ROLES = ["Titulaire", "Remplaçant"] as const;

export const statRowSchema = z.object({
  role: z.enum(MATCH_ROLES),
  position: z.string().trim().max(60).nullable(),
  minutes: z.number().int().min(0).max(120),
  goals: z.number().int().min(0).max(20),
  assists: z.number().int().min(0).max(20),
  note: z.number().min(0).max(10).nullable(),
  comment: z.string().trim().max(2000).nullable(),
});

export const neededSchema = z.number().int().min(1).max(30);

export const COMPETITION_TYPES = ["Championnat", "Amical", "Tournoi", "Coupe", "Plateau", "Autre"] as const;
export type CompetitionType = (typeof COMPETITION_TYPES)[number];

export const competitionSchema = z.enum(COMPETITION_TYPES);

export const OBJECTIVE_STATUSES = ["ATTEINT", "PARTIEL", "NON_ATTEINT"] as const;
export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];

export const OBJECTIVE_STATUS_LABELS: Record<ObjectiveStatus, string> = {
  ATTEINT: "Atteint",
  PARTIEL: "Partiellement atteint",
  NON_ATTEINT: "Non atteint",
};

const freeText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);

export const bilanSchema = z.object({
  objectiveStatus: z.enum(OBJECTIVE_STATUSES).nullable(),
  collectiveNote: freeText(4000),
  firstHalfNote: freeText(2000),
  secondHalfNote: freeText(2000),
  positivePoints: freeText(2000),
  improvementAreas: freeText(2000),
  notableEvents: freeText(2000),
});

// Only meaningful when competition === "Tournoi", but both fields stay
// optional throughout — a tournament's ranking is only known once it's
// over (§13/§14).
export const tournamentSchema = z
  .object({
    tournamentRanking: z.number().int().min(1).nullable(),
    tournamentTeamsCount: z.number().int().min(2).nullable(),
  })
  .refine((v) => v.tournamentRanking === null || v.tournamentTeamsCount === null || v.tournamentRanking <= v.tournamentTeamsCount, {
    message: "Le classement ne peut pas dépasser le nombre d'équipes.",
  });
