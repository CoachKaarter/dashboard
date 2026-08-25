-- Activation/désactivation de l'injection des résultats du week-end dans le
-- message d'ouverture des dispos (variable {{resultats}}). Défaut false,
-- non destructive : aucun message existant n'est modifié tant que le club
-- n'a pas explicitement activé l'option depuis /parametres.
ALTER TABLE "Club" ADD COLUMN "includeWeekendResultsInAvailabilityMessage" BOOLEAN NOT NULL DEFAULT false;
