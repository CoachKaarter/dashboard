import { z } from "zod";
import { sessionBlockTypeSchema } from "@/lib/session-block-validation";

// Reuses the exact same type referential as SessionBlock (§5 of the V5.1
// spec: avoid two separate taxonomies).
export const contentTypeSchema = sessionBlockTypeSchema;

export const contentFormatSchema = z.enum(["Foot à 5", "Foot à 8", "Foot à 11", "Tous"]);

export const contentVisibilitySchema = z.enum(["PERSONAL", "SHARED"]);

// Generous but bounded — reject absurd/abusive payloads without being a
// tight product constraint (§73).
const shortText = z.string().trim().min(1).max(200);
const longText = z.string().trim().max(4000).nullable().optional();

export const contentItemSchema = z
  .object({
    title: shortText,
    type: contentTypeSchema,
    description: longText,
    objective: longText,
    organization: longText,
    instructions: longText,
    coachingPoints: longText,
    variations: longText,
    space: z.string().trim().max(200).nullable().optional(),
    equipment: z.string().trim().max(500).nullable().optional(),
    imageUrl: z.string().trim().url().max(2000).nullable().optional().or(z.literal("")),
    defaultDurationMinutes: z.number().finite().min(1).max(360).nullable().optional(),
    minPlayers: z.number().int().min(1).max(30).nullable().optional(),
    maxPlayers: z.number().int().min(1).max(30).nullable().optional(),
    format: contentFormatSchema.nullable().optional(),
    categories: z.array(z.string().trim().max(20)).max(10).default([]),
    visibility: contentVisibilitySchema,
  })
  // Case 74 — minPlayers <= maxPlayers when both are set.
  .refine((v) => v.minPlayers == null || v.maxPlayers == null || v.minPlayers <= v.maxPlayers, {
    message: "Le nombre minimum de joueurs doit être inférieur ou égal au maximum.",
    path: ["minPlayers"],
  });

export const tagNameSchema = z.string().trim().min(1).max(40);

export function slugifyTag(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const sessionTemplateNameSchema = z.string().trim().min(1).max(120);
