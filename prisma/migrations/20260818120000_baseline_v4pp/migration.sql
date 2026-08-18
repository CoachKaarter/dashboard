-- Baseline migration — pre-V5 hardening (see prisma/migrations_archive/README.md)
--
-- This migration's CREATE TABLE statements must NEVER be run against the
-- existing production database — every one of these 32 tables already
-- exists there, built up manually across Phases 1-4/V2/V4++. This file
-- exists so that:
--   1. A brand-new empty database (a fresh dev environment, a future
--      staging DB) can be built from `prisma migrate deploy` alone.
--   2. Production's migration history can be marked as "already applied"
--      via `prisma migrate resolve --applied 20260818120000_baseline_v4pp`
--      (a live DB connection is required for that one command — see
--      prisma/migrations_archive/README.md for status).
-- From this point forward, every schema change should go through a real
-- `prisma migrate dev` and get its own timestamped migration folder here.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "accessLabel" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "teamIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'Foot à 8',
    "targetSize" INTEGER,
    "coachId" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "teamId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "positionAlt" TEXT NOT NULL,
    "foot" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "joinedLabel" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unavailability" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "expectedReturn" TIMESTAMP(3),
    "actualReturn" TIMESTAMP(3),
    "createdById" TEXT,
    "source" TEXT NOT NULL DEFAULT 'STAFF',
    "status" TEXT NOT NULL DEFAULT 'VALIDATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentAccount" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAvailability" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "sessionId" TEXT,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "absenceReason" TEXT,
    "comment" TEXT,
    "answeredBy" TEXT NOT NULL DEFAULT 'PARENT',
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyAvailabilityWindow" (
    "id" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'CLOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyAvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionFeedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "preFeeling" INTEGER,
    "fatigue" TEXT,
    "pain" BOOLEAN,
    "painLocation" TEXT,
    "preAnsweredAt" TIMESTAMP(3),
    "postFeeling" INTEGER,
    "rpe" INTEGER,
    "enjoyment" INTEGER,
    "comment" TEXT,
    "postAnsweredAt" TIMESTAMP(3),
    "calculatedLoad" INTEGER,

    CONSTRAINT "SessionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerNote" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamHistoryEntry" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromTeamId" TEXT,
    "toTeamId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "decidedById" TEXT,

    CONSTRAINT "TeamHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringSlot" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "scopeTeamId" TEXT,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "scopeTeamId" TEXT,
    "label" TEXT NOT NULL,
    "theme" TEXT,
    "objective" TEXT,
    "sourceSlotId" TEXT,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT,
    "arrivalTime" TIMESTAMP(3),
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionBlock" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "objective" TEXT,
    "organization" TEXT,
    "instructions" TEXT,
    "space" TEXT,
    "equipment" TEXT,
    "imageUrl" TEXT,
    "coachNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "actualDurationMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "opponent" TEXT,
    "competition" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "meetTime" TEXT,
    "isHome" BOOLEAN NOT NULL DEFAULT true,
    "location" TEXT,
    "status" TEXT NOT NULL,
    "needed" INTEGER NOT NULL DEFAULT 12,
    "formation" TEXT NOT NULL DEFAULT '1-3-3-1',
    "scoreFor" INTEGER,
    "scoreAgainst" INTEGER,
    "shareToken" TEXT NOT NULL,
    "preMatchObjective" TEXT,
    "objectiveMet" BOOLEAN,
    "collectiveNote" TEXT,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchConvocation" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "confirmed" BOOLEAN,

    CONSTRAINT "MatchConvocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekendAssignment" (
    "id" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekendDate" TIMESTAMP(3) NOT NULL,
    "playerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "matchId" TEXT,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekendAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchStaffAssignment" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "MatchStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeekendPlan" (
    "id" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekendDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validatedAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeekendPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerInterview" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "playerFeeling" TEXT,
    "playerFeedback" TEXT,
    "playerExpectations" TEXT,
    "playerDifficulties" TEXT,
    "coachFeedback" TEXT,
    "strengths" TEXT,
    "developmentAreas" TEXT,
    "agreedSummary" TEXT,
    "privateNotes" TEXT,
    "nextReviewDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerObjective" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdFromInterviewId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'A_TRAVAILLER',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "visibleToPlayer" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerObjectiveUpdate" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerObjectiveUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositionSlot" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "CompositionSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayerStat" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "note" DOUBLE PRECISION,
    "comment" TEXT,

    CONSTRAINT "MatchPlayerStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationScore" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "technique" DOUBLE PRECISION NOT NULL,
    "tactique" DOUBLE PRECISION NOT NULL,
    "physique" DOUBLE PRECISION NOT NULL,
    "comportement" DOUBLE PRECISION NOT NULL,
    "objectives" TEXT,
    "comment" TEXT,
    "evaluatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jersey" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT,
    "responsible" TEXT NOT NULL,
    "issuedDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "returnedDate" TIMESTAMP(3),
    "condition" TEXT NOT NULL,

    CONSTRAINT "Jersey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "location" TEXT,
    "teamId" TEXT,
    "teamLabel" TEXT NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertTreated" (
    "id" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRAITE',
    "snoozeUntil" TIMESTAMP(3),
    "comment" TEXT,
    "assignedToId" TEXT,
    "treatedById" TEXT,
    "treatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertTreated_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "seuilPresence" INTEGER NOT NULL DEFAULT 60,
    "fenetreSeances" INTEGER NOT NULL DEFAULT 5,
    "absRecentes" INTEGER NOT NULL DEFAULT 3,
    "seuilANJ" INTEGER NOT NULL DEFAULT 5,
    "delaiEval" INTEGER NOT NULL DEFAULT 60,
    "ecartTdj" INTEGER NOT NULL DEFAULT 90,
    "delaiConvoc" INTEGER NOT NULL DEFAULT 21,
    "delaiMaillots" INTEGER NOT NULL DEFAULT 3,
    "periodeTdj" INTEGER NOT NULL DEFAULT 30,
    "horizonMatch" INTEGER NOT NULL DEFAULT 10,
    "minMinutes" INTEGER NOT NULL DEFAULT 30,
    "delaiRdv" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Team_code_key" ON "Team"("code");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Unavailability_playerId_idx" ON "Unavailability"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentAccount_playerId_key" ON "ParentAccount"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentAccount_username_key" ON "ParentAccount"("username");

-- CreateIndex
CREATE INDEX "PlayerAvailability_playerId_weekStartDate_idx" ON "PlayerAvailability"("playerId", "weekStartDate");

-- CreateIndex
CREATE INDEX "PlayerAvailability_sessionId_idx" ON "PlayerAvailability"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAvailability_playerId_eventDate_type_key" ON "PlayerAvailability"("playerId", "eventDate", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyAvailabilityWindow_weekStartDate_key" ON "WeeklyAvailabilityWindow"("weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "SessionFeedback_sessionId_playerId_key" ON "SessionFeedback"("sessionId", "playerId");

-- CreateIndex
CREATE INDEX "PlayerNote_playerId_idx" ON "PlayerNote"("playerId");

-- CreateIndex
CREATE INDEX "TeamHistoryEntry_playerId_idx" ON "TeamHistoryEntry"("playerId");

-- CreateIndex
CREATE INDEX "TrainingSession_date_idx" ON "TrainingSession"("date");

-- CreateIndex
CREATE INDEX "Attendance_playerId_idx" ON "Attendance"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_playerId_key" ON "Attendance"("sessionId", "playerId");

-- CreateIndex
CREATE INDEX "SessionBlock_sessionId_idx" ON "SessionBlock"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_shareToken_key" ON "Match"("shareToken");

-- CreateIndex
CREATE INDEX "Match_teamId_idx" ON "Match"("teamId");

-- CreateIndex
CREATE INDEX "Match_date_idx" ON "Match"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MatchConvocation_matchId_playerId_key" ON "MatchConvocation"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "WeekendAssignment_weekStartDate_idx" ON "WeekendAssignment"("weekStartDate");

-- CreateIndex
CREATE INDEX "WeekendAssignment_teamId_idx" ON "WeekendAssignment"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "WeekendAssignment_weekendDate_playerId_key" ON "WeekendAssignment"("weekendDate", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchStaffAssignment_matchId_userId_role_key" ON "MatchStaffAssignment"("matchId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "WeekendPlan_weekStartDate_key" ON "WeekendPlan"("weekStartDate");

-- CreateIndex
CREATE INDEX "PlayerInterview_playerId_idx" ON "PlayerInterview"("playerId");

-- CreateIndex
CREATE INDEX "PlayerObjective_playerId_idx" ON "PlayerObjective"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionSlot_matchId_slotIndex_key" ON "CompositionSlot"("matchId", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionSlot_matchId_playerId_key" ON "CompositionSlot"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayerStat_matchId_playerId_key" ON "MatchPlayerStat"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationScore_playerId_period_key" ON "EvaluationScore"("playerId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Jersey_code_key" ON "Jersey"("code");

-- CreateIndex
CREATE INDEX "CalendarEvent_date_idx" ON "CalendarEvent"("date");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertTreated_alertKey_key" ON "AlertTreated"("alertKey");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Season_label_key" ON "Season"("label");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unavailability" ADD CONSTRAINT "Unavailability_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unavailability" ADD CONSTRAINT "Unavailability_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAccount" ADD CONSTRAINT "ParentAccount_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAvailability" ADD CONSTRAINT "PlayerAvailability_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAvailability" ADD CONSTRAINT "PlayerAvailability_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionFeedback" ADD CONSTRAINT "SessionFeedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionFeedback" ADD CONSTRAINT "SessionFeedback_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerNote" ADD CONSTRAINT "PlayerNote_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerNote" ADD CONSTRAINT "PlayerNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamHistoryEntry" ADD CONSTRAINT "TeamHistoryEntry_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamHistoryEntry" ADD CONSTRAINT "TeamHistoryEntry_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamHistoryEntry" ADD CONSTRAINT "TeamHistoryEntry_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamHistoryEntry" ADD CONSTRAINT "TeamHistoryEntry_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringSlot" ADD CONSTRAINT "RecurringSlot_scopeTeamId_fkey" FOREIGN KEY ("scopeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_scopeTeamId_fkey" FOREIGN KEY ("scopeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_sourceSlotId_fkey" FOREIGN KEY ("sourceSlotId") REFERENCES "RecurringSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBlock" ADD CONSTRAINT "SessionBlock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchConvocation" ADD CONSTRAINT "MatchConvocation_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchConvocation" ADD CONSTRAINT "MatchConvocation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekendAssignment" ADD CONSTRAINT "WeekendAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekendAssignment" ADD CONSTRAINT "WeekendAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekendAssignment" ADD CONSTRAINT "WeekendAssignment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekendAssignment" ADD CONSTRAINT "WeekendAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchStaffAssignment" ADD CONSTRAINT "MatchStaffAssignment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchStaffAssignment" ADD CONSTRAINT "MatchStaffAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeekendPlan" ADD CONSTRAINT "WeekendPlan_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerInterview" ADD CONSTRAINT "PlayerInterview_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerInterview" ADD CONSTRAINT "PlayerInterview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerObjective" ADD CONSTRAINT "PlayerObjective_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerObjective" ADD CONSTRAINT "PlayerObjective_createdFromInterviewId_fkey" FOREIGN KEY ("createdFromInterviewId") REFERENCES "PlayerInterview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerObjective" ADD CONSTRAINT "PlayerObjective_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerObjectiveUpdate" ADD CONSTRAINT "PlayerObjectiveUpdate_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "PlayerObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionSlot" ADD CONSTRAINT "CompositionSlot_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionSlot" ADD CONSTRAINT "CompositionSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationScore" ADD CONSTRAINT "EvaluationScore_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jersey" ADD CONSTRAINT "Jersey_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jersey" ADD CONSTRAINT "Jersey_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertTreated" ADD CONSTRAINT "AlertTreated_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertTreated" ADD CONSTRAINT "AlertTreated_treatedById_fkey" FOREIGN KEY ("treatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- The app connects via a private Postgres role, not Supabase's anon-key
-- PostgREST API — RLS must stay disabled on every app table or every
-- write 500s with a 42501 error. Supabase has repeatedly auto-enabled RLS
-- on newly-created tables in this project (at least 3 times across prior
-- phases); disabling it here, for every table, up front, closes that gap
-- for anyone bootstrapping a fresh database from this migration.
ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Team" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Player" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Unavailability" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentAccount" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerAvailability" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "WeeklyAvailabilityWindow" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionFeedback" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerNote" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "TeamHistoryEntry" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "RecurringSlot" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingSession" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionBlock" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Match" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "MatchConvocation" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "WeekendAssignment" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "MatchStaffAssignment" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "WeekendPlan" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerInterview" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerObjective" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerObjectiveUpdate" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "CompositionSlot" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "MatchPlayerStat" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "EvaluationScore" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Jersey" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "CalendarEvent" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "AlertTreated" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ActivityLog" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Season" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Settings" DISABLE ROW LEVEL SECURITY;
