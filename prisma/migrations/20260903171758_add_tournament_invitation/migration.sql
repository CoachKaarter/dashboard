-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "tournamentInvitationId" TEXT;

-- CreateTable
CREATE TABLE "TournamentInvitation" (
    "id" TEXT NOT NULL,
    "organizingClub" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responseDeadline" TIMESTAMP(3),
    "practicalInfo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TournamentInvitation_status_idx" ON "TournamentInvitation"("status");

-- CreateIndex
CREATE INDEX "TournamentInvitation_date_idx" ON "TournamentInvitation"("date");

-- CreateIndex
CREATE INDEX "Match_tournamentInvitationId_idx" ON "Match"("tournamentInvitationId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentInvitationId_fkey" FOREIGN KEY ("tournamentInvitationId") REFERENCES "TournamentInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentInvitation" ADD CONSTRAINT "TournamentInvitation_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentInvitation" ADD CONSTRAINT "TournamentInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RowLevelSecurity
ALTER TABLE "TournamentInvitation" ENABLE ROW LEVEL SECURITY;
