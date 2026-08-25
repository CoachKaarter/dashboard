-- Suivi des mesures physiques (poids, taille, tests) — catalogue extensible
-- de types de test plutôt qu'un jeu de colonnes fixe, pour pouvoir ajouter
-- un nouveau test depuis l'écran "Mesures" sans redéploiement.
CREATE TABLE "PhysicalTestType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "lowerIsBetter" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhysicalTestType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhysicalTestResult" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "testTypeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhysicalTestResult_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PhysicalTestType_name_key" ON "PhysicalTestType"("name");

CREATE INDEX "PhysicalTestResult_playerId_idx" ON "PhysicalTestResult"("playerId");

CREATE INDEX "PhysicalTestResult_testTypeId_idx" ON "PhysicalTestResult"("testTypeId");

CREATE UNIQUE INDEX "PhysicalTestResult_playerId_testTypeId_date_key" ON "PhysicalTestResult"("playerId", "testTypeId", "date");

ALTER TABLE "PhysicalTestResult" ADD CONSTRAINT "PhysicalTestResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhysicalTestResult" ADD CONSTRAINT "PhysicalTestResult_testTypeId_fkey" FOREIGN KEY ("testTypeId") REFERENCES "PhysicalTestType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PhysicalTestResult" ADD CONSTRAINT "PhysicalTestResult_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PhysicalTestType" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "PhysicalTestResult" ENABLE ROW LEVEL SECURITY;
