-- DropForeignKey
ALTER TABLE "Player" DROP CONSTRAINT "Player_teamId_fkey";

-- AlterTable: add category nullable first, backfill from the player's
-- current team (every existing row has one), then enforce NOT NULL.
ALTER TABLE "Player" ADD COLUMN     "category" TEXT,
ALTER COLUMN "teamId" DROP NOT NULL;

UPDATE "Player" p SET "category" = t."category" FROM "Team" t WHERE t.id = p."teamId";

ALTER TABLE "Player" ALTER COLUMN "category" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Player_category_idx" ON "Player"("category");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
