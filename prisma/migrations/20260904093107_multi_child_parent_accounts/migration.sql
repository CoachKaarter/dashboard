-- ============================================================
-- Step 1: ParentAccountPlayer join table — one row per (account, child).
-- Backfilled from the existing 1:1 ParentAccount.playerId before that
-- column is dropped later in this migration.
-- ============================================================
CREATE TABLE "ParentAccountPlayer" (
    "id" TEXT NOT NULL,
    "parentAccountId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentAccountPlayer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParentAccountPlayer_playerId_key" ON "ParentAccountPlayer"("playerId");
CREATE INDEX "ParentAccountPlayer_parentAccountId_idx" ON "ParentAccountPlayer"("parentAccountId");

ALTER TABLE "ParentAccountPlayer" ADD CONSTRAINT "ParentAccountPlayer_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "ParentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParentAccountPlayer" ADD CONSTRAINT "ParentAccountPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ParentAccountPlayer" ("id", "parentAccountId", "playerId", "createdAt")
SELECT gen_random_uuid()::text, "id", "playerId", "createdAt" FROM "ParentAccount";

-- ============================================================
-- Step 2: ParentContentState gains an explicit playerId — its old unique
-- key (parentAccountId, entityType, entityId) would otherwise collide
-- across siblings once one account can have several children (e.g. two
-- kids' "AVAILABILITY_WEEK" state for the same week would be the same
-- row). Backfilled via the still-present ParentAccount.playerId.
-- ============================================================
ALTER TABLE "ParentContentState" ADD COLUMN "playerId" TEXT;

UPDATE "ParentContentState" cs SET "playerId" = pa."playerId" FROM "ParentAccount" pa WHERE pa.id = cs."parentAccountId";

ALTER TABLE "ParentContentState" ALTER COLUMN "playerId" SET NOT NULL;

DROP INDEX "ParentContentState_parentAccountId_entityType_entityId_key";
CREATE UNIQUE INDEX "ParentContentState_parentAccountId_playerId_entityType_ent_key" ON "ParentContentState"("parentAccountId", "playerId", "entityType", "entityId");
CREATE INDEX "ParentContentState_playerId_idx" ON "ParentContentState"("playerId");

ALTER TABLE "ParentContentState" ADD CONSTRAINT "ParentContentState_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Step 3: ParentAccount.email — the family's contact email, used to
-- auto-link a second child's invitation to this same account. Backfilled
-- from the most recent USED invitation for the account's (still present)
-- playerId, which is the historically accurate address the family
-- activated with (Player.parentEmail may have changed since).
-- ============================================================
ALTER TABLE "ParentAccount" ADD COLUMN "email" TEXT;

UPDATE "ParentAccount" pa SET "email" = sub.email
FROM (
  SELECT DISTINCT ON ("playerId") "playerId", email
  FROM "ParentInvitation"
  WHERE "usedAt" IS NOT NULL
  ORDER BY "playerId", "usedAt" DESC
) sub
WHERE sub."playerId" = pa."playerId";

-- Fallback for the rare case no matching used invitation is found (should
-- not happen in practice — every ParentAccount is created exclusively via
-- activateParentAccount, which always consumes one) — falls back to the
-- linked player's administrative parentEmail rather than leaving it null.
UPDATE "ParentAccount" pa SET "email" = p."parentEmail"
FROM "Player" p
WHERE p.id = pa."playerId" AND pa."email" IS NULL AND p."parentEmail" IS NOT NULL;

ALTER TABLE "ParentAccount" ALTER COLUMN "email" SET NOT NULL;

-- ============================================================
-- Step 4: ParentAccount gains the parent's own profile fields (filled by
-- the parent during the new mandatory onboarding step) and the
-- onboarding gate itself. Existing accounts are backfilled with a non-null
-- onboardingCompletedAt so the mandatory form only ever fires for
-- accounts activated after this ships — same discipline as
-- User.onboardingCompletedAt for staff.
-- ============================================================
ALTER TABLE "ParentAccount" ADD COLUMN "firstName" TEXT;
ALTER TABLE "ParentAccount" ADD COLUMN "lastName" TEXT;
ALTER TABLE "ParentAccount" ADD COLUMN "phone" TEXT;
ALTER TABLE "ParentAccount" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

UPDATE "ParentAccount" SET "onboardingCompletedAt" = "createdAt";

-- ============================================================
-- Step 5: drop the old 1:1 link now that ParentAccountPlayer carries it.
-- ============================================================
ALTER TABLE "ParentAccount" DROP CONSTRAINT "ParentAccount_playerId_fkey";
ALTER TABLE "ParentAccount" DROP CONSTRAINT IF EXISTS "ParentAccount_playerId_key";
DROP INDEX IF EXISTS "ParentAccount_playerId_key";
ALTER TABLE "ParentAccount" DROP COLUMN "playerId";

-- ============================================================
-- Step 6: Player gains the two fields written only via staff validation
-- of a PlayerFamilyInfoSubmission — never directly from the parent app.
-- ============================================================
ALTER TABLE "Player" ADD COLUMN "licenseNumber" TEXT;
ALTER TABLE "Player" ADD COLUMN "birthDate" TIMESTAMP(3);

-- ============================================================
-- Step 7: PlayerFamilyInfoSubmission — parent-declared child info,
-- pending staff validation (same source/status idiom as Unavailability).
-- ============================================================
CREATE TABLE "PlayerFamilyInfoSubmission" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerFamilyInfoSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlayerFamilyInfoSubmission_playerId_idx" ON "PlayerFamilyInfoSubmission"("playerId");
CREATE INDEX "PlayerFamilyInfoSubmission_status_idx" ON "PlayerFamilyInfoSubmission"("status");

ALTER TABLE "PlayerFamilyInfoSubmission" ADD CONSTRAINT "PlayerFamilyInfoSubmission_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerFamilyInfoSubmission" ADD CONSTRAINT "PlayerFamilyInfoSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "ParentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerFamilyInfoSubmission" ADD CONSTRAINT "PlayerFamilyInfoSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
