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

export const statRowSchema = z.object({
  minutes: z.number().int().min(0).max(120),
  goals: z.number().int().min(0).max(20),
  assists: z.number().int().min(0).max(20),
  note: z.number().min(0).max(10).nullable(),
  comment: z.string().trim().max(2000).nullable(),
});

export const neededSchema = z.number().int().min(1).max(30);
