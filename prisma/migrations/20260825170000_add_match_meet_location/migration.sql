-- Lieu de rendez-vous avant le match, distinct du terrain (Match.location) :
-- une équipe peut se retrouver au club puis partir ensemble vers un terrain
-- extérieur, par exemple. meetTime existait déjà pour l'heure ; ce champ
-- ajoute le lieu correspondant. Facultatif, jamais renseigné automatiquement.
ALTER TABLE "Match" ADD COLUMN "meetLocation" TEXT;
