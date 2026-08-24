-- V5.2 Phase 1 — Match model foundations: preparation/tournoi/bilan fields,
-- and objectiveMet (Boolean) replaced by objectiveStatus (3-state: ATTEINT
-- | PARTIEL | NON_ATTEINT), matching "Objectif atteint / partiellement
-- atteint / non atteint" instead of a plain yes/no.
--
-- Additive except for the objectiveMet -> objectiveStatus swap, which
-- backfills existing data before dropping the old column so no bilan
-- already recorded is silently lost.

ALTER TABLE "Match"
  ADD COLUMN "mainInstructions" TEXT,
  ADD COLUMN "preMatchNotes" TEXT,
  ADD COLUMN "tournamentRanking" INTEGER,
  ADD COLUMN "tournamentTeamsCount" INTEGER,
  ADD COLUMN "objectiveStatus" TEXT,
  ADD COLUMN "firstHalfNote" TEXT,
  ADD COLUMN "secondHalfNote" TEXT,
  ADD COLUMN "positivePoints" TEXT,
  ADD COLUMN "improvementAreas" TEXT,
  ADD COLUMN "notableEvents" TEXT;

UPDATE "Match" SET "objectiveStatus" = CASE
  WHEN "objectiveMet" = true THEN 'ATTEINT'
  WHEN "objectiveMet" = false THEN 'NON_ATTEINT'
  ELSE NULL
END;

ALTER TABLE "Match" DROP COLUMN "objectiveMet";
