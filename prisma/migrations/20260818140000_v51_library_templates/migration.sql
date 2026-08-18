-- V5.1 — Session Studio & bibliothèque pédagogique (Phase 1 — Data)
--
-- Additive only: new tables (TrainingContentItem, TrainingContentTag,
-- TrainingContentFavorite, SessionTemplate, SessionTemplateBlock, and the
-- implicit _ContentItemTags many-to-many) + 3 nullable columns on
-- SessionBlock (sourceLibraryItemId, coachingPoints, variations). Nothing
-- destructive, no backfill needed — existing SessionBlock rows keep working
-- unchanged. Generated via:
--   prisma migrate diff --from-schema <schema before V5.1> --to-schema prisma/schema.prisma --script
--
-- Apply with `prisma migrate deploy` per prisma/MIGRATIONS.md (this is a
-- real, new change — not a baseline to `resolve --applied`).

-- AlterTable
ALTER TABLE "SessionBlock" ADD COLUMN     "coachingPoints" TEXT,
ADD COLUMN     "sourceLibraryItemId" TEXT,
ADD COLUMN     "variations" TEXT;

-- CreateTable
CREATE TABLE "TrainingContentItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "organization" TEXT,
    "instructions" TEXT,
    "coachingPoints" TEXT,
    "variations" TEXT,
    "space" TEXT,
    "equipment" TEXT,
    "imageUrl" TEXT,
    "defaultDurationMinutes" INTEGER,
    "minPlayers" INTEGER,
    "maxPlayers" INTEGER,
    "format" TEXT,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PERSONAL',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingContentTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingContentTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingContentFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingContentFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PERSONAL',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTemplateBlock" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "objective" TEXT,
    "organization" TEXT,
    "instructions" TEXT,
    "coachingPoints" TEXT,
    "variations" TEXT,
    "space" TEXT,
    "equipment" TEXT,
    "imageUrl" TEXT,
    "sourceLibraryItemId" TEXT,

    CONSTRAINT "SessionTemplateBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ContentItemTags" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ContentItemTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "TrainingContentItem_createdById_idx" ON "TrainingContentItem"("createdById");

-- CreateIndex
CREATE INDEX "TrainingContentItem_type_idx" ON "TrainingContentItem"("type");

-- CreateIndex
CREATE INDEX "TrainingContentItem_archived_idx" ON "TrainingContentItem"("archived");

-- CreateIndex
CREATE INDEX "TrainingContentItem_visibility_idx" ON "TrainingContentItem"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingContentTag_name_key" ON "TrainingContentTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingContentTag_slug_key" ON "TrainingContentTag"("slug");

-- CreateIndex
CREATE INDEX "TrainingContentFavorite_contentItemId_idx" ON "TrainingContentFavorite"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingContentFavorite_userId_contentItemId_key" ON "TrainingContentFavorite"("userId", "contentItemId");

-- CreateIndex
CREATE INDEX "SessionTemplate_createdById_idx" ON "SessionTemplate"("createdById");

-- CreateIndex
CREATE INDEX "SessionTemplate_archived_idx" ON "SessionTemplate"("archived");

-- CreateIndex
CREATE INDEX "SessionTemplateBlock_templateId_idx" ON "SessionTemplateBlock"("templateId");

-- CreateIndex
CREATE INDEX "SessionTemplateBlock_sourceLibraryItemId_idx" ON "SessionTemplateBlock"("sourceLibraryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionTemplateBlock_templateId_order_key" ON "SessionTemplateBlock"("templateId", "order");

-- CreateIndex
CREATE INDEX "_ContentItemTags_B_index" ON "_ContentItemTags"("B");

-- CreateIndex
CREATE INDEX "SessionBlock_sourceLibraryItemId_idx" ON "SessionBlock"("sourceLibraryItemId");

-- AddForeignKey
ALTER TABLE "SessionBlock" ADD CONSTRAINT "SessionBlock_sourceLibraryItemId_fkey" FOREIGN KEY ("sourceLibraryItemId") REFERENCES "TrainingContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingContentItem" ADD CONSTRAINT "TrainingContentItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingContentFavorite" ADD CONSTRAINT "TrainingContentFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingContentFavorite" ADD CONSTRAINT "TrainingContentFavorite_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "TrainingContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplate" ADD CONSTRAINT "SessionTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateBlock" ADD CONSTRAINT "SessionTemplateBlock_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SessionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTemplateBlock" ADD CONSTRAINT "SessionTemplateBlock_sourceLibraryItemId_fkey" FOREIGN KEY ("sourceLibraryItemId") REFERENCES "TrainingContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContentItemTags" ADD CONSTRAINT "_ContentItemTags_A_fkey" FOREIGN KEY ("A") REFERENCES "TrainingContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContentItemTags" ADD CONSTRAINT "_ContentItemTags_B_fkey" FOREIGN KEY ("B") REFERENCES "TrainingContentTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Supabase auto-enables RLS on new tables; this app connects via a private
-- role, not the anon-key PostgREST API — disable it up front (see
-- prisma/MIGRATIONS.md for why this is project convention).
ALTER TABLE "TrainingContentItem" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingContentTag" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingContentFavorite" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionTemplate" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionTemplateBlock" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "_ContentItemTags" DISABLE ROW LEVEL SECURITY;
