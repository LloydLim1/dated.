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
- Automatic OpenStreetMap discovery with a continuous map, floating search/results, category chips, optional device location, and retry states. City-level views prioritize prominent places; zooming reveals more detailed, non-overlapping named labels.
- Verified business logos beside place names; category symbols replace missing logos and initials. Restaurants, cafés, museums and cinemas retain stable identities for saves, outings, reviews, and photo posts.
- Place-tagged journal photo posts with up to ten pictures, captions, swipe/keyboard galleries, likes, comments, editing, deletion, and public/followers/private visibility. Pictures appear in the journal, community, contributor profiles, and place pages according to access permissions.
- Persistent local registration, sign-in, sign-out, profile editing, and private collections.
- Resuming account-gated journeys after sign-in, collection creation while saving, collection renaming/deletion, and place links that work with refresh and browser navigation.
- Category-specific reviews, photographs, spending, editing, deletion, visibility, and incentive disclosure.
- Transparent place scores use each account's latest public, non-incentivized visit. Independent reviewer and evidence-support counts, early-impression labels, and supported-visit filters explain the evidence. Repeat accounts and shared outings cannot inflate trending or map prominence.
- Following, a chronological Following feed, helpful votes, comments, contributor profiles, reports, and appeals.
- Multi-stop outings with reordering, optional invitations, participant acceptance, per-person consent visibility, withdrawal, and a visited journal state. Participants can review individual stops.
- Editable outing plans, adding a place to an existing plan, estimated itinerary spending, Upcoming/Visited views, invitation previews, and protection for unfinished forms.
- Dated Premium is a free preview: customize an itinerary title/introduction, stop order, times, durations, notes and optional planned budgets. Choose timeline/compact layouts and forest/rose/slate palettes, save a private design, publish a revocable snapshot link, copy the plan, print/save a PDF, or download timed stops as a calendar file. Private outing notes and companion details are excluded from shared copies.
- Private visit evidence, explicit moderator assessment, moderation decisions, and an audit history.
- Account JSON export and password-confirmed account deletion.
- Responsive navigation, keyboard-accessible native dialogs, reduced motion, install metadata, and a safe offline fallback. Private API responses are never stored in a service-worker cache.

The supplied eight places and community stories are **fictional sample content**, labeled separately from real OpenStreetMap discoveries. Cards and place pages use full-width photo covers: public journal photos first, otherwise a category photograph explicitly labeled illustrative. Authentic logos or category symbols appear in small corner badges. Followers-only and private photos never become directory covers. Missing prices are not treated as free. Demo reviews never contribute to venue ratings. No public deployment has been made.

The map uses the full imported Metro Manila catalog at city scale, with 1.5 km live nearby searches at closer zooms. Restaurants, cafés, fast-food venues, food courts, museums and cinemas are supported. OpenFreeMap Positron supplies the base map, with OpenStreetMap/OpenMapTiles attribution. Label prominence uses Dated visits/reviews and mapped landmarks as a fallback; it does not reproduce Google's proprietary popularity rankings. Coverage and opening hours depend on community mapping; this cannot guarantee every business. Approximate search coordinates go to the Overpass provider; device location is only requested when the visitor chooses Near me and is never attached to a post. Photo uploads remove EXIF metadata.

Responses are cached for ten minutes and requests are serialized, bounded, and rate-limited. The default public Overpass service is limited to 100 uncached searches per day across this pilot. For a public deployment, configure `DATED_OVERPASS_URL` for a dedicated/self-hosted provider and use a licensed production map style. Tests use a local fixture service and never depend on public Overpass availability.

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

Still needed before public launch: real branch-specific venue data, cloud repository/auth/storage implementation, verified email and recovery, stronger age assurance, a licensed production map service, media moderation/scanning, privacy/operator contact details, load testing, operational monitoring, abuse monitoring, a privacy impact assessment, and a hosted pilot. Premium remains a free preview with no active payment or subscription service. Localhost share links work on this device; sharing with friends on other devices requires a deployed app.

See [verification](docs/verification.md) and [asset provenance](docs/assets.md).

See [frontend journeys](docs/user-journeys.md) for the complete screen flow map. The production frontend review can be repeated with `node scripts/frontend-qa.mjs` against a preview at port 3400 (or set `QA_BASE_URL`). Use a separate `DATED_DATA_DIR` for that preview: the review creates and removes disposable test accounts. Screenshots and results are saved in `docs/frontend/`.

## Metro Manila directory and weekly updates

Run the full restaurant, café, museum and cinema import with `npm run places:sync`. `-- --force` refreshes immediately; `-- --audit` shows the saved coverage report. It scans the mapped NCR boundary and validates all 17 city/municipality boundaries before importing named restaurants, cafés, fast-food outlets, food courts, museums and cinemas. This is public directory coverage, not an exhaustive census of every business. IDs remain stable and user ratings, photos, and saved places survive imports. Incomplete provider responses are rejected. `npm run museums:sync` refreshes only museums; `-- --audit` shows its source coverage.

The current local catalog contains 11,865 mapped food places, with verified cached logos on 3,489 listings and confirmed Philippine menu sources on 1,339. Of those menus, 1,285 were reachable, 53 unavailable and one restricted during source checking; unavailable menus are hidden and retained for the next check. Explicit published peso prices appear on 92 listings. Pickup Coffee's verified Philippine menu publishes item data used to show a sourced range; Hap Chan and Gerry's Philippine menu pages also expose named items with explicit peso prices. Those ranges are separate from estimated spending per person and can include sharing platters. ArmyNavy uses the exact ordering-menu link published by its Philippine homepage; other businesses on that platform are not automatically approved. Official Philippine operator pages added 260 logos across Max's Restaurant, Pancake House, Yellow Cab and Chooks to Go. The remaining 8,376 food listings still need authentic logo sources; their cards use full-width illustrative covers and show no invented initials or substitute marks. Unknown pricing is never interpreted as free. All listings still support ratings and journal photos, and review spending is optional. The cinema import adds 59 named mapped records, including individually mapped screens, with ticket/showtime details rather than food menus. Use `npm run cinemas:sync` to refresh cinemas separately.

Menus are checked weekly. Explicit PHP offers and peso price ranges can update published pricing; image-only menus and branch-specific ordering prices are not guessed. Published menu links that reject automated checks remain labeled. Local logo assets are decoded and cached, with source links; website logos require matching business identity and header/home context, and reject unrelated redirects, parked domains, publisher marks, partner badges, and social icons. Published official Philippine brand sites supplement missing map metadata. Pale transparent wordmarks receive a dark backing for legibility. Websites that clearly no longer represent the business are not linked from its detail page.

Successful full scans mark missing listings as unconfirmed without deleting their history. Those pages ask users to check with the business before visiting and retain reviews/photo memories; absence from a map is not treated as proof of closure. Returning listings regain confirmed status. Older snapshots and unexpectedly large total/city count drops are rejected before changing the catalog.

With `DATED_AUTO_REFRESH=true`, a persistent Node server checks for due work hourly and refreshes seven days after the last successful scan, catching up after downtime. Food, museum and cinema imports have separate leases and failure recovery. A local Codex automation is configured for Mondays at 4:00 AM Asia/Manila; its saved status is currently paused. A hosted always-on server/scheduler is needed for updates while the local machine is offline. Admin accounts can also use My journal → Refresh places directory.

The user-provided Café Guide PH directory was checked in the browser. Its public café identities provide 16 unambiguous name-and-city reference matches; the listing links appear on those Dated place pages. It is primarily a photo directory, not a complete business-logo feed. No Google ratings, descriptions, or café photographs are imported. These guide references are a dated manual snapshot: automated requests to that directory return HTTP 403, so its reference snapshot is not advertised as a live weekly feed.

Menus are restricted to confirmed Philippine operator sources. Global US brand menu pages, unconfirmed social links, and redirects to unrelated sites are suppressed. Source country is verified separately from logo provenance; an authentic global brand mark does not make a global menu suitable for a Philippine branch.

The Philippine Museums directory's 88 entries are reconciled into 79 museum identities after merging eight duplicates and skipping one combined National Museum entry. Combined with additional named mapped museums, Dated has 120 real museum listings: 99 mapped and 21 with listed addresses but pending exact pins. All remain searchable and usable in reviews, photo journals, collections and outings. Unconfirmed coordinates are stored as null and excluded from map/nearby results. Admission is reported with directory attribution and a reminder to confirm current discounts, reservations and prices; it is separate from estimated spending. Closure notices are preserved. The Metropolitan Museum's old Manila map object is excluded; its current official Taguig address appears with a source link.

Backups include `logos/`, brand index/audit and museum cache/audit alongside the database and media. Preserve those files when restoring a pilot.
