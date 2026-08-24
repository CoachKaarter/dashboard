-- Soft-delete marker for TrainingSession. Set only when deleteSession() can't
-- hard-delete a row that matches an active RecurringSlot, so the generator
-- (ensureUpcomingSessions(), which decides "already generated" purely from
-- row existence) doesn't silently recreate it. Every display query filters
-- deletedAt: null; the generator's own existence check deliberately does not.
ALTER TABLE "TrainingSession" ADD COLUMN "deletedAt" TIMESTAMP(3);
