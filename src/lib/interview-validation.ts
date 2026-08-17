import { z } from "zod";

export const interviewTypeSchema = z.enum([
  "DEBUT_SAISON",
  "POINT_INTERMEDIAIRE",
  "MI_SAISON",
  "FIN_SAISON",
  "EXCEPTIONNEL",
  "RETOUR_BLESSURE",
  "CHANGEMENT_GROUPE",
  "COMPORTEMENT",
  "PROJET_INDIVIDUEL",
]);

export const objectiveCategorySchema = z.enum(["TECHNIQUE", "TACTIQUE", "PHYSIQUE", "MENTAL", "COMPORTEMENT", "AUTRE"]);
export const objectiveStatusSchema = z.enum(["A_TRAVAILLER", "EN_PROGRESSION", "ACQUIS", "ABANDONNE"]);
