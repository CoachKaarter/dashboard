-- Permissions multi-catégories : un utilisateur peut cumuler plusieurs
-- responsabilités (StaffAccess), chacune un niveau (COACH/RESPONSABLE) sur
-- un périmètre (une équipe précise, une catégorie entière, ou l'école de
-- foot au complet). User.role reste un rôle TECHNIQUE (staff CRUD, branding,
-- paramètres) — il ne donne plus, à lui seul, un accès sportif automatique.
-- User.teamIds est gelé (plus écrit par le nouveau code) mais conservé —
-- c'est la donnée source du backfill ci-dessous, et rien ne le supprime.

ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

ALTER TABLE "Settings" ADD COLUMN "schoolFootballCategories" TEXT[] NOT NULL DEFAULT ARRAY['U6','U7','U8','U9','U10','U11','U12','U13']::TEXT[];

CREATE TABLE "StaffAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "category" TEXT,
    "teamId" TEXT,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAccess_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffAccess_userId_idx" ON "StaffAccess"("userId");

CREATE INDEX "StaffAccess_teamId_idx" ON "StaffAccess"("teamId");

-- Empêche les doublons exacts d'une même responsabilité, par type de
-- périmètre (index partiels — un même utilisateur ne peut pas se voir
-- attribuer deux fois "RESPONSABLE U8", mais peut avoir à la fois un accès
-- TEAM et un accès CATEGORY qui se chevauchent si c'est voulu).
CREATE UNIQUE INDEX "StaffAccess_user_category_key" ON "StaffAccess"("userId", "scope", "category") WHERE "scope" = 'CATEGORY';

CREATE UNIQUE INDEX "StaffAccess_user_team_key" ON "StaffAccess"("userId", "scope", "teamId") WHERE "scope" = 'TEAM';

CREATE UNIQUE INDEX "StaffAccess_user_school_key" ON "StaffAccess"("userId", "scope") WHERE "scope" = 'SCHOOL';

ALTER TABLE "StaffAccess" ADD CONSTRAINT "StaffAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffAccess" ADD CONSTRAINT "StaffAccess_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffAccess" ADD CONSTRAINT "StaffAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StaffAccess" ENABLE ROW LEVEL SECURITY;

-- Backfill non destructif : chaque équipe déjà listée dans l'ancien
-- User.teamIds d'un compte non-ADMIN devient une responsabilité COACH/TEAM
-- explicite. Les comptes ADMIN ne sont volontairement PAS backfillés ici —
-- sous l'ancien modèle, role='ADMIN' donnait un accès total sans jamais lire
-- teamIds, donc ce champ n'a aucune valeur fiable pour eux ; leur périmètre
-- sportif réel (ex. Marvyn → RESPONSABLE U12+U13) doit être attribué
-- explicitement, pas deviné depuis une donnée qui n'a jamais compté.
INSERT INTO "StaffAccess" ("id", "userId", "level", "scope", "teamId", "createdAt")
SELECT gen_random_uuid()::text, u."id", 'COACH', 'TEAM', t."teamId", CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN LATERAL unnest(u."teamIds") AS t("teamId")
WHERE u."role" != 'ADMIN'
ON CONFLICT DO NOTHING;
