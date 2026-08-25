-- Onboarding (première connexion) redirige tout compte dont
-- onboardingCompletedAt est NULL vers /onboarding avant de le laisser
-- accéder au reste de l'app. Sans ce backfill, chaque compte staff déjà
-- actif (Marvyn, Davy, etc.) se retrouverait bloqué sur cet écran à sa
-- prochaine requête — cette migration marque tous les comptes déjà
-- existants comme "déjà onboardés" au moment du déploiement, pour que
-- l'écran ne se déclenche que pour les comptes créés après.
UPDATE "User" SET "onboardingCompletedAt" = CURRENT_TIMESTAMP WHERE "onboardingCompletedAt" IS NULL;
