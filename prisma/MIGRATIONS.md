# Migrations — how this project's Prisma history works

## Current state (pre-V5 hardening, 2026-08-18)

`prisma/migrations/` contains exactly one migration:
**`20260818120000_baseline_v4pp`** — the complete current schema (32
models), generated with:

```
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```

This replaces the old `20260816031830_init` (moved to
`prisma/migrations_archive/`, see the README there for why). Every
schema change made between Phase 2 and V4++ was applied to the
production database by hand (manual SQL in Supabase's SQL Editor, later
via the Supabase MCP connector) without ever generating a matching
migration file — so the tracked history and the real database had
drifted apart. Re-baselining (Prisma's own documented fix for exactly
this situation) was safer than trying to reconstruct an incremental
diff by hand.

## ⚠️ One step is still outstanding

Production's `_prisma_migrations` table needs to be told "the baseline
migration is already applied" — **without ever running its SQL**,
since every table it creates already exists. That's a single command,
but it requires a live connection to the production database, which
this environment did not have when the baseline was generated:

```bash
npx prisma migrate resolve --applied 20260818120000_baseline_v4pp
```

Run this once, from a machine/session with `DATABASE_URL` pointing at
production (or via the Supabase SQL editor / MCP connector — see
below). Until this runs, `prisma migrate deploy` against production
would try to execute the baseline's `CREATE TABLE` statements and fail
with `relation "User" already exists` (harmless — it just means this
step hasn't run yet — but do it before the next real migration).

**How to tell if it's already been done:** run `npx prisma migrate
status` against production. If it says "Database schema is up to
date!", it's done. If it lists `20260818120000_baseline_v4pp` as not
yet applied, run the `resolve --applied` command above first.

**If you don't have `prisma migrate resolve` available** (no direct
Postgres connection, only the Supabase SQL editor/MCP), the equivalent
manual step is inserting one row into `_prisma_migrations` yourself:

```sql
insert into "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
values
  (gen_random_uuid()::text, '', now(), '20260818120000_baseline_v4pp', null, null, now(), 1);
```

(`checksum` can be left as an empty string — Prisma only warns, it
doesn't hard-fail on a mismatched/missing checksum for a manually
resolved migration.)

## Second migration: `20260818130000_sessionblock_order_unique`

Unlike the baseline above, this one is a **real, new** schema change and
must actually be executed against production with `prisma migrate
deploy` (never `migrate resolve --applied` — that would skip it and
leave production without the constraint). It:

1. Normalizes any pre-existing duplicate `SessionBlock.order` values
   within a session (nothing enforced uniqueness before this, so
   concurrent creation/edits could in theory have produced duplicates)
   by deterministically renumbering each session's blocks to `0..n-1`,
   ordered by the existing `order` then `id`. No-op for sessions that
   already have distinct orders.
2. Adds `@@unique([sessionId, order])`.

Apply it (after the baseline's `resolve --applied` step above has been
done) with:

```bash
npx prisma migrate deploy
```

`src/app/(app)/seances/[id]/blocks-actions.ts` was updated alongside
this migration: `swapBlocks` now moves one of the two blocks to a
temporary out-of-range order (`-1`) inside the transaction before
assigning final values, since a naive two-row swap
(`A.order = B.order; B.order = A.order`) would conflict with this
unique constraint the instant the first UPDATE runs. `createBlock`'s
"last order + 1" now derives the next order from a single aggregate
query inside the same transaction as the insert, reducing (though, per
Partie E's own "don't over-engineer, this is an internal tool" caveat,
not exhaustively eliminating under extreme concurrency) the race window.

## Third migration: `20260818140000_v51_library_templates`

V5.1 (Session Studio & bibliothèque pédagogique) data layer — purely
additive: new tables (`TrainingContentItem`, `TrainingContentTag`,
`TrainingContentFavorite`, `SessionTemplate`, `SessionTemplateBlock`, the
implicit `_ContentItemTags` join table) plus 3 nullable columns on
`SessionBlock` (`sourceLibraryItemId`, `coachingPoints`, `variations`). No
backfill needed, existing rows unaffected. A real, new change — apply with
`prisma migrate deploy`, same as the previous one.

## Fourth migration: `20260820140000_staff_announcements`

Espace Parents redesign — one new table, `StaffAnnouncement` (the "Infos"
tab feed, authored from a new Cockpit page). Purely additive, no existing
table touched. A real, new change — apply with `prisma migrate deploy`.

## Fifth migration: `20260824090439_v52_match_foundations`

V5.2 Phase 1 (cycle Match complet) — `Match` gains prep fields
(`mainInstructions`, `preMatchNotes`), tournoi fields (`tournamentRanking`,
`tournamentTeamsCount`), and a structured bilan (`firstHalfNote`,
`secondHalfNote`, `positivePoints`, `improvementAreas`, `notableEvents`).
`objectiveMet` (Boolean) is replaced by `objectiveStatus` (3-state: ATTEINT
| PARTIEL | NON_ATTEINT) — the migration backfills existing data (`true` →
`ATTEINT`, `false` → `NON_ATTEINT`) before dropping the old column, so no
previously-recorded bilan is lost. Applied directly against production via
the Supabase MCP connector (this session had live DB access for the first
time) and registered in `_prisma_migrations` — see the connector's
`apply_migration`/`execute_sql` calls in this session for the exact
checksum used.

## Supabase RLS & grants (2026-08-21 hardening)

Every migration up to and including `20260820140000_staff_announcements`
ended with `ALTER TABLE ... DISABLE ROW LEVEL SECURITY;` on its new
table(s). That convention is reversed as of this hardening pass: Supabase
exposes every `public` table to `anon`/`authenticated` through its Data
API (PostgREST) by default — with RLS off, those roles had full
`SELECT/INSERT/UPDATE/DELETE` on every business table, reachable with
nothing but the project's public anon key. This app never uses that API
(it talks to Postgres directly via Prisma), so that access was pure
unnecessary exposure, not something the app relied on.

The fix (see the hardening script given to the user, not stored in this
repo since it must be reviewed and run once by hand in Supabase's SQL
editor — a blind rerun would fail loudly and harmlessly on already-`ENABLE`d
tables, but there's no reason to keep re-running it):

1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` on every business table,
   with zero policies defined — Postgres denies all rows to any role
   that isn't the table owner or `BYPASSRLS`, by default. No app code or
   Prisma query changes as a result.
2. `REVOKE ALL ... FROM anon, authenticated;` on every business table —
   belt-and-suspenders, so access is denied by grant as well as by RLS.
3. `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE
   ALL ON TABLES FROM anon, authenticated;` so tables created by future
   migrations don't silently regain the old exposure.

**Why this doesn't break Prisma:** the app's Postgres connection must use a
role that bypasses RLS. **This project's actual app role is `app_prisma`**
(connects via Supavisor — confirmed by querying `pg_stat_activity` while
the app was live, since the role name isn't visible from the Vercel
dashboard for a `Sensitive`-flagged env var). It is a dedicated,
non-superuser role and, at the time RLS was first enabled, did **not**
have `BYPASSRLS` — enabling RLS with no policies broke every DB read
(`prisma.user.findUnique` returned nothing, so staff logins failed with
"identifiant/mot de passe incorrect") until this was run:
```sql
ALTER ROLE app_prisma BYPASSRLS;
```
Before touching RLS on any table again, confirm the app's actual role and
its `BYPASSRLS` status — don't assume it's `postgres`:
```sql
SELECT usename, application_name, count(*) FROM pg_stat_activity
WHERE datname = current_database() GROUP BY usename, application_name;
SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'app_prisma';
```

## From now on: applying a new migration

Once the outstanding step above is done, this project works like any
normal Prisma project:

1. Edit `prisma/schema.prisma`.
2. Generate a migration **file** without touching the live database yet:
   ```bash
   npx prisma migrate dev --create-only --name <short_description>
   ```
   (`--create-only` matters — it writes the SQL file but does not run
   it, so you can review it first. This project's schema is full of
   `String` fields standing in for enums, `String?` motif fields, and
   deliberately-named `@@unique` compound keys — always read the
   generated SQL before applying it.)
3. Review `prisma/migrations/<timestamp>_<name>/migration.sql`. **Do not
   disable RLS on new tables** — see "Supabase RLS & grants" below for
   why that convention was reversed. For a new table, instead add:
   ```sql
   ALTER TABLE "NewTable" ENABLE ROW LEVEL SECURITY;
   REVOKE ALL ON TABLE "NewTable" FROM anon, authenticated;
   ```
   With no policies defined, `ENABLE ROW LEVEL SECURITY` alone already
   denies every row to `anon`/`authenticated` (Supabase's Data API
   roles); the `REVOKE` is belt-and-suspenders. Neither affects Prisma's
   own connection, which uses the table-owning role and bypasses RLS —
   confirmed safe for this project, see below.
4. Apply it to production with:
   ```bash
   npx prisma migrate deploy
   ```
   Never `prisma db push` against production (no migration history,
   easy to silently accept data loss), never `prisma migrate reset`
   against production (drops everything).
5. Commit the new migration folder to git. The migration history in
   git and the state of production must never diverge again — if a
   change ever needs to be made by hand (an emergency hotfix in the
   Supabase SQL editor), immediately generate a matching migration file
   afterward and `migrate resolve --applied` it, the same way this
   baseline was created.

## Environment note

This sandbox has no Docker daemon and no reachable local Postgres, so
`prisma migrate dev` (which needs a shadow database to compute diffs
safely) cannot run end-to-end here. `--create-only` combined with
`migrate diff --from-empty --to-schema` (used for this baseline) does
not require a shadow database. Running the full `migrate dev` /
`migrate deploy` flow requires a real `DATABASE_URL` — either a proper
local Postgres, or the actual production connection string when
deliberately applying to production.
