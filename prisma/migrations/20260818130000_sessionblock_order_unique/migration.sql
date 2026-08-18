-- Pré-V5 hardening — Partie E (SessionBlock order integrity)
--
-- Adds @@unique([sessionId, order]) to SessionBlock. Before adding the
-- constraint, this migration first normalizes any pre-existing duplicate
-- `order` values within a session (possible today since nothing prevented
-- them) by deterministically renumbering each session's blocks to 0..n-1,
-- ordered by the existing `order` then `id` as a tiebreaker. This is a
-- no-op for any session that already has distinct, ordered values, and
-- only actually changes rows for sessions that have a collision.
--
-- Safe to run via `prisma migrate deploy` (unlike the baseline migration,
-- this one is a genuine, real, new schema change and must actually be
-- executed against production — not `migrate resolve --applied`).

-- Normalize existing orders (idempotent, resolves any duplicates deterministically)
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "sessionId" ORDER BY "order" ASC, "id" ASC) - 1 AS "newOrder"
  FROM "SessionBlock"
)
UPDATE "SessionBlock" AS sb
SET "order" = ranked."newOrder"
FROM ranked
WHERE sb."id" = ranked."id" AND sb."order" IS DISTINCT FROM ranked."newOrder";

-- CreateIndex
CREATE UNIQUE INDEX "SessionBlock_sessionId_order_key" ON "SessionBlock"("sessionId", "order");
