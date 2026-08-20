-- Espace Parents redesign — annonces du staff (onglet "Infos")
--
-- Additive only: one new table. Apply with `prisma migrate deploy` (real,
-- new change — not a baseline to `resolve --applied`). See
-- prisma/MIGRATIONS.md for the current outstanding-migrations state.

CREATE TABLE "StaffAnnouncement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "targetCategory" TEXT NOT NULL,
    "scopeTeamId" TEXT,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAnnouncement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffAnnouncement_targetCategory_idx" ON "StaffAnnouncement"("targetCategory");
CREATE INDEX "StaffAnnouncement_scopeTeamId_idx" ON "StaffAnnouncement"("scopeTeamId");
CREATE INDEX "StaffAnnouncement_createdAt_idx" ON "StaffAnnouncement"("createdAt");

ALTER TABLE "StaffAnnouncement" ADD CONSTRAINT "StaffAnnouncement_scopeTeamId_fkey" FOREIGN KEY ("scopeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffAnnouncement" ADD CONSTRAINT "StaffAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase auto-enables RLS on new tables; this app connects via a private
-- role, not the anon-key PostgREST API — disable it up front.
ALTER TABLE "StaffAnnouncement" DISABLE ROW LEVEL SECURITY;
