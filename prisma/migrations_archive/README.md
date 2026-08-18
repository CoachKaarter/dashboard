# Archived migrations

`20260816031830_init` is the *first* migration ever generated for this
project (Phase 1). It has been moved out of `prisma/migrations/` — kept
here for historical record only, not executed — because it stopped
representing what production actually looks like a long time ago.

## Why

From Phase 2 through V4++, the production database was evolved directly
(manual SQL run in Supabase's SQL Editor, later via the Supabase MCP
connector) every time `prisma/schema.prisma` grew a new model or field.
`prisma/migrations/` was never updated to match. By the pre-V5 hardening
pass, `schema.prisma` described 32 models; the tracked migration history
still only described the handful from `init`.

Replaying `init` on an empty database and then trying to layer a diff on
top would either (a) require a shadow database to compute that diff
accurately — unavailable in this environment (no Docker daemon, no
reachable local Postgres) — or (b) require assuming the diff by hand,
which risks silently missing a manually-applied change.

## What was done instead

A full **re-baseline** (Prisma's documented pattern for a database whose
tracked migrations have drifted from its real schema — see
https://www.prisma.io/docs/orm/prisma-migrate/getting-started#adding-prisma-migrate-to-an-existing-project):

1. Generate one fresh migration containing the *entire current schema*
   (`prisma migrate diff --from-empty --to-schema prisma/schema.prisma
   --script`) — this is `prisma/migrations/<timestamp>_baseline_v4pp/`.
2. Mark that single migration as already-applied against production via
   `prisma migrate resolve --applied <timestamp>_baseline_v4pp` —
   **never actually run its CREATE TABLE statements against production**,
   since every one of those tables already exists there. This step
   requires a live connection to the production database and could not
   be completed from this environment this session (see the migrations
   README for the exact command and current status).
3. From this point forward, `prisma migrate dev` / `prisma migrate
   deploy` work normally against a migration history that actually
   matches reality.

This `init` migration's SQL is preserved here in case anyone needs to
see exactly what Phase 1 originally created, but it must never be placed
back in `prisma/migrations/` and run — the baseline migration already
contains a superset of everything in it.
