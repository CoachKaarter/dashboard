-- AlterTable
ALTER TABLE "Club" ALTER COLUMN "id" SET DEFAULT 1;

-- CreateTable
CREATE TABLE "SessionExpectation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "expected" BOOLEAN NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionExpectation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionExpectation_sessionId_idx" ON "SessionExpectation"("sessionId");

-- CreateIndex
CREATE INDEX "SessionExpectation_playerId_idx" ON "SessionExpectation"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionExpectation_sessionId_playerId_key" ON "SessionExpectation"("sessionId", "playerId");

-- AddForeignKey
ALTER TABLE "SessionExpectation" ADD CONSTRAINT "SessionExpectation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExpectation" ADD CONSTRAINT "SessionExpectation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionExpectation" ADD CONSTRAINT "SessionExpectation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RowLevelSecurity
ALTER TABLE "SessionExpectation" ENABLE ROW LEVEL SECURITY;
