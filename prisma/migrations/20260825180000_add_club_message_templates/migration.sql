-- Modèles éditables des 2 messages "à copier" côté staff (disponibilités,
-- convocations). null = texte par défaut codé en dur.
ALTER TABLE "Club" ADD COLUMN "availabilityMessageTemplate" TEXT;
ALTER TABLE "Club" ADD COLUMN "convocationMessageTemplate" TEXT;
