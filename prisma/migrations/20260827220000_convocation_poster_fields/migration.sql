-- Feuille de convocation (poster) : trois champs additifs nécessaires pour
-- ne jamais coder en dur des informations qui doivent venir de la
-- configuration du club (niveau d'équipe, terrain du match, téléphone du
-- staff). Aucune donnée existante modifiée.
ALTER TABLE "Team" ADD COLUMN "level" TEXT;
ALTER TABLE "Match" ADD COLUMN "surface" TEXT;
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
