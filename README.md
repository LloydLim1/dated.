# Dated

A working, mobile-first local pilot for discovering places, saving collections, sharing structured reviews, and keeping multi-stop outings together.

## Run

Requires Node.js **22.19 or later** (the local store uses `node:sqlite`).

```powershell
npm ci
npm run dev
```

Open **http://127.0.0.1:3000**. Create an account using Join Dated; no preconfigured password or administrator account is shipped. Open a second browser profile to try companion invitations between two accounts.

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm start
```

Tests use a separate `.data-test` database and Chrome. They do not touch pilot accounts. Inside a restricted Windows execution environment, the runner needs permission to stop its own child server processes.

## What works

- Search by place, category, neighborhood, or city; filter by category, occasion, and estimated budget.
- Grid and MapLibre map discovery; optional device location with a manual city alternative.
- Persistent local registration, sign-in, sign-out, profile editing, and private collections.
- Category-specific reviews, photographs, spending, editing, deletion, visibility, and incentive disclosure.
- Following, a chronological Following feed, helpful votes, comments, contributor profiles, reports, and appeals.
- Multi-stop outings with reordering, optional invitations, participant acceptance, per-person consent visibility, withdrawal, and a visited journal state. Participants can review individual stops.
- Private visit evidence, explicit moderator assessment, moderation decisions, and an audit history.
- Account JSON export and password-confirmed account deletion.
- Responsive navigation, keyboard-accessible native dialogs, reduced motion, install metadata, and a safe offline fallback. Private API responses are never stored in a service-worker cache.

The supplied directory and community stories are **fictional sample content**. Place photographs illustrate categories and do not document those venues. Demo reviews never contribute to venue ratings. No public deployment has been made.

## Moderation and operations

Register the moderator account normally, then grant its role from the local operator console:

```powershell
npm run admin -- moderator@example.com
```

Open My journal → Moderation. Report decisions require a reason. Receipt uploads never automatically earn a Visit Supported indicator. This indicator concerns visit evidence, not the reviewer's opinion.

Run maintenance daily while the pilot is in use:

```powershell
node scripts/maintenance.mjs
```

This deletes expired evidence, uploads abandoned for more than a day, expired sessions, counters, and orphaned image files. Evidence access stops immediately after its 30-day expiry even before maintenance runs.

Pause writes before taking a consistent database-and-media snapshot:

```powershell
node scripts/backup.mjs .backups/pilot-2026-10-08
```

The target must be a new directory separate from the active data directory. To restore, stop the server, preserve its existing data directory, and point `DATED_DATA_DIR` at a copied backup containing `dated.sqlite` and `media/`. Start the app and verify accounts, media, and `PRAGMA integrity_check`. Do not overwrite a running store.

## Hosting limitations

The running implementation uses **Next.js + a persistent SQLite/filesystem store**, rather than the recommended Supabase hosting stack. It runs without cloud credentials and supports real separate accounts locally. A single Node server with durable storage can run this pilot; **do not deploy this store to Vercel or another ephemeral/serverless filesystem**.

Supabase Auth, PostgreSQL/PostGIS, Storage, and Vercel are not connected. See [production plan](docs/production-plan.md) for the remaining infrastructure work and [architecture](docs/architecture.md) for the trust boundaries. Setting Supabase variables alone will not migrate the app.

Still needed before public launch: real branch-specific venue data, cloud repository/auth/storage implementation, verified email and recovery, stronger age assurance, a licensed production map service, media moderation/scanning, privacy/operator contact details, load testing, operational monitoring, abuse monitoring, a privacy impact assessment, and a hosted pilot. Premium and payments remain deferred as requested.

See [verification](docs/verification.md) and [asset provenance](docs/assets.md).
