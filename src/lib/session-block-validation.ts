import { z } from "zod";

export const sessionBlockTypeSchema = z.enum([
  "ACCUEIL",
  "ACTIVATION",
  "TECHNIQUE",
  "EXERCICE",
  "SITUATION",
  "JEU",
  "PHYSIQUE",
  "RETOUR_AU_CALME",
  "AUTRE",
]);

export const sessionBlockStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "DONE", "SKIPPED"]);
