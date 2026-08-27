-- Journée cohésion : nouveau kind "cohesion" pour CalendarEvent (valeur
-- libre côté application, aucun changement de schéma requis pour ça) +
-- un champ "program" pour détailler le déroulé de la journée. Purement
-- additif, aucune donnée existante modifiée.
ALTER TABLE "CalendarEvent" ADD COLUMN "program" TEXT;
