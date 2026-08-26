-- Accueil Parent v2 — mémoire NEW/SEEN/COMPLETED générique pour l'espace
-- parent, plus un instantané JSON minimal utilisé pour détecter les
-- modifications (convocation déplacée, séance dont l'horaire change) sans
-- ajouter de colonne updatedAt à Match/TrainingSession. Nouvelle table,
-- aucune donnée existante modifiée.
CREATE TABLE "ParentContentState" (
    "id" TEXT NOT NULL,
    "parentAccountId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentContentState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParentContentState_parentAccountId_entityType_entityId_key" ON "ParentContentState"("parentAccountId", "entityType", "entityId");

CREATE INDEX "ParentContentState_parentAccountId_idx" ON "ParentContentState"("parentAccountId");

ALTER TABLE "ParentContentState" ADD CONSTRAINT "ParentContentState_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "ParentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
