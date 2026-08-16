# Cockpit U12/U13 — Saint-Sébastien FC

Internal season-management tool for the U12/U13 category, implemented from the
`Cockpit U12-U13.dc.html` design prototype (see `../chats/chat1.md` and
`../README.md` at the repo root for the original brief and design handoff).

## Stack

- Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS v4
- Prisma 7 + SQLite (`@prisma/adapter-better-sqlite3`) for local, single-file persistence
- Auth.js v5 (Credentials provider, JWT sessions) — no external auth provider, since this is a private staff-only tool

## Getting started

```bash
npm install
npx prisma migrate dev   # creates dev.db and applies the schema
npx prisma db seed       # populates realistic French U12/U13 demo data
npm run dev
```

Then open http://localhost:3000 and sign in with any of the seeded staff
accounts (password `motdepasse` for all of them):

| Username  | Rôle                        |
|-----------|-----------------------------|
| `marvyn`  | Responsable de catégorie (admin) |
| `marina`  | Coach U13B                  |
| `davy`    | Coach U13C                  |
| `sofiane` | Coach U12A                  |
| `karim`   | Entraîneur des gardiens     |
| `elodie`  | Dirigeante                  |

## Notable implementation choices

- **Alerts are computed, not stored.** `src/lib/alerts.ts` derives the Urgent /
  À traiter / À surveiller / Information groups from live data (missing
  opponents, incomplete convocations, attendance below threshold, low
  playing-time share, stale evaluations, late jerseys) using the tunable
  thresholds in the **Paramètres** screen. Only the "marked as treated" flag is
  persisted (`AlertTreated`), keyed by a deterministic alert key.
- **Player stats are computed, not cached** (`src/lib/stats.ts`): attendance
  rate, minutes, titularisations, evaluation deltas, etc. are all derived from
  the real relational data (`Attendance`, `MatchPlayerStat`,
  `EvaluationScore`) rather than stored as redundant fields.
- **Composition (lineup) drag-and-drop** is a small client component
  (`src/components/CompositionBoard.tsx`) using native HTML5 DnD, backed by
  server actions that persist each slot assignment immediately.
- To reset to a clean demo state: `npx prisma migrate reset` (re-applies the
  schema and re-seeds automatically prompts for confirmation — it's a
  destructive operation, only ever run it against `dev.db`).

## What's stubbed / out of scope for this pass

- "Envoyer la convocation" / "Proposer une sélection" buttons on the match
  convocation screen are visual only (no notification system exists yet).
- No player photo upload — avatars are initials, matching the prototype.
- Staff management (adding/removing users, changing passwords) has no UI yet;
  accounts are seed-only. The Staff screen is read-only.
