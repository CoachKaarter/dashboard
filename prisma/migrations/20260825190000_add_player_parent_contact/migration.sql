-- Coordonnées administratives d'un parent/responsable légal, saisies par le
-- staff sur la fiche joueur — n'a aucun rapport avec ParentAccount (les
-- identifiants de connexion à l'espace parents).
ALTER TABLE "Player" ADD COLUMN "parentName" TEXT;
ALTER TABLE "Player" ADD COLUMN "parentPhone" TEXT;
ALTER TABLE "Player" ADD COLUMN "parentEmail" TEXT;
