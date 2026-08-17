import { z } from "zod";

export const availabilityStatusSchema = z.enum(["AVAILABLE", "UNAVAILABLE"]);
export const absenceReasonSchema = z.enum(["Maladie", "Famille", "École", "Autre"]);
export const unavailabilityTypeSchema = z.enum(["Blessure", "Maladie", "Absence longue", "Autre"]);

export const preFeelingSchema = z.coerce.number().int().min(1).max(5);
export const postFeelingSchema = z.coerce.number().int().min(1).max(5);
export const rpeSchema = z.coerce.number().int().min(1).max(10);
export const enjoymentSchema = z.coerce.number().int().min(1).max(3);
export const fatigueSchema = z.enum(["Pas du tout", "Un peu", "Beaucoup"]);
export const painSchema = z.enum(["oui", "non"]);
