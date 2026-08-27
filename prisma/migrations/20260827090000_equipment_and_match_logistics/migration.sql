-- Cockpit v1.1 — (1) champs logistiques Match destinés à la fiche de
-- convocation parent (tous facultatifs, distincts des champs tactiques
-- internes existants mainInstructions/preMatchObjective/preMatchNotes qui
-- restent staff-only) ; (2) généralisation du matériel : Jersey est
-- remplacé par Equipment + EquipmentAssignment (réutilisable au-delà des
-- seuls sacs de maillots), avec migration des données existantes.

ALTER TABLE "Match"
  ADD COLUMN "estimatedEndTime" TEXT,
  ADD COLUMN "estimatedReturnTime" TEXT,
  ADD COLUMN "venueAddress" TEXT,
  ADD COLUMN "transportMode" TEXT,
  ADD COLUMN "dressCode" TEXT,
  ADD COLUMN "personalGear" TEXT,
  ADD COLUMN "mealInfo" TEXT,
  ADD COLUMN "parentInstructions" TEXT,
  ADD COLUMN "parentNotes" TEXT;

CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "teamId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Equipment_code_key" ON "Equipment"("code");
CREATE INDEX "Equipment_teamId_idx" ON "Equipment"("teamId");
CREATE INDEX "Equipment_category_idx" ON "Equipment"("category");

ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EquipmentAssignment" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "matchId" TEXT,
    "playerId" TEXT,
    "parentAccountId" TEXT,
    "responsibleLabel" TEXT NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "returnLocation" TEXT,
    "parentReportedAt" TIMESTAMP(3),
    "returnedDate" TIMESTAMP(3),
    "washed" BOOLEAN,
    "condition" TEXT,
    "staffComment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CHEZ_LE_JOUEUR',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EquipmentAssignment_equipmentId_idx" ON "EquipmentAssignment"("equipmentId");
CREATE INDEX "EquipmentAssignment_playerId_idx" ON "EquipmentAssignment"("playerId");
CREATE INDEX "EquipmentAssignment_parentAccountId_idx" ON "EquipmentAssignment"("parentAccountId");
CREATE INDEX "EquipmentAssignment_matchId_idx" ON "EquipmentAssignment"("matchId");
CREATE INDEX "EquipmentAssignment_status_idx" ON "EquipmentAssignment"("status");

ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "ParentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Même posture que le reste du schéma : RLS activé, aucune policy — la
-- connexion applicative (rôle propriétaire des tables) contourne RLS de
-- fait, PostgREST anon/authenticated n'a donc par construction aucun accès
-- (l'app ne passe jamais par PostgREST — NextAuth + Prisma en connexion
-- directe). Pas de policy à écrire : voir "public.Jersey" et toutes les
-- autres tables existantes, mêmes réglages.
ALTER TABLE "Equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EquipmentAssignment" ENABLE ROW LEVEL SECURITY;

-- ---- Migration des données : Jersey -> Equipment + EquipmentAssignment ----
-- Un seul cycle d'attribution par sac existant (l'historique démarre à
-- partir de maintenant) ; le sac lui-même devient l'Equipment (code repris
-- à l'identique), la ligne Jersey devient sa première EquipmentAssignment.
INSERT INTO "Equipment" ("id", "category", "code", "label", "teamId", "active", "createdAt")
SELECT gen_random_uuid()::text, 'MAILLOTS', "code", 'Sac de maillots', "teamId", true, "issuedDate"
FROM "Jersey";

INSERT INTO "EquipmentAssignment" (
  "id", "equipmentId", "playerId", "responsibleLabel", "issuedDate", "dueDate",
  "returnedDate", "condition", "status", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  e."id",
  j."playerId",
  j."responsible",
  j."issuedDate",
  j."dueDate",
  j."returnedDate",
  j."condition",
  CASE WHEN j."returnedDate" IS NOT NULL THEN 'RECUPERE_STAFF' ELSE 'CHEZ_LE_JOUEUR' END,
  j."issuedDate",
  now()
FROM "Jersey" j
JOIN "Equipment" e ON e."code" = j."code";

DROP TABLE "Jersey";
