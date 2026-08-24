-- V5.2 Phase 2 — Composition prévue vs réalité.
--
-- Adds plannedRole (frozen at generateFeuille() time, never rewritten
-- afterward) and position (poste réellement joué). Backfills plannedRole
-- from the existing role column for any row already created before this
-- migration — the best available approximation, since "what was actually
-- planned" for those rows was never captured before.

ALTER TABLE "MatchPlayerStat" ADD COLUMN "plannedRole" TEXT;
ALTER TABLE "MatchPlayerStat" ADD COLUMN "position" TEXT;

UPDATE "MatchPlayerStat" SET "plannedRole" = "role" WHERE "plannedRole" IS NULL;

ALTER TABLE "MatchPlayerStat" ALTER COLUMN "plannedRole" SET NOT NULL;
