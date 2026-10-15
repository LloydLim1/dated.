# Architecture and trust boundaries

The revised local commerce, rewards, advertising, collection-sharing and planning domains are documented in [current implementation](revised-platform-implementation.md). The baseline below describes the original pilot; the current domain boundaries extend it without a cloud migration. Commercial writes run through `commerce-core.mjs`, category/filter definitions are shared with the server, and a persistent local worker handles rewards, expiry and monthly report snapshots.

The app is a modular monolith: Next.js routes and React surfaces, shared types and validation, a server-only authentication layer, a read model, and a transactional local database. The SQLite store is an explicit local-pilot choice to make all primary journeys usable without external account provisioning.

| Area | Implementation |
| --- | --- |
| Navigation | Home, Explore, Map, Saved, Community, Outings, Profile; deep routes and browser back/forward |
| Identity | Salted scrypt password hashes, random 256-bit sessions stored as SHA-256 digests, HttpOnly/SameSite cookies, 7-day expiry |
| Authorization | Every mutation checks the current server session; ownership and visibility are checked independently of the browser |
| Data | Foreign keys and transactional creation for accounts and outings; additive review/outing migration; indexes for social and review reads |
| Reviews | Configurable category criteria in shared definitions; one review per author/place/date; one review per author/outing stop |
| Privacy | Private collections; public, followers-only, or private reviews and outings; participation visible only under accepted companion consent |
| Evidence | Separate private media kind; author/moderator access; 30-day access expiry; maintenance removes expired files |
| Images | JPG/PNG/WebP, 4 MB cap, bounded decoded pixels, re-encoded WebP with metadata removal, maximum four review photos |
| Moderation | Member reports, author appeals, explicit operator-granted admin role, recorded decisions and evidence assessment |
| Integrity | Demo stories excluded from ratings; latest public review per author contributes to a venue score; Trending groups shared outing events and uses recent independent activity |
| PWA | Manifest, icon, standalone display, static offline fallback; no cached private content |

`src/server/db.ts` owns the local schema. `src/server/auth.ts` enforces sessions, request origin, rate counters, and visibility. `src/server/validation.ts` validates every submitted domain object. `src/server/read.ts` returns only authorized content and deliberately omits shared outing identifiers from outsider review responses to avoid correlating private participation. `src/app/api/[...path]/route.ts` coordinates trusted writes and media access.

The local endpoint bounds bootstrap reads to 200 reviews and outings, and contributor discovery to 100 profiles. Place results paginate in the browser. These limits fit the sample pilot but are not a production-scale cursor API. Geolocation remains in client memory; only venue coordinates reach the server. The preview map uses OpenStreetMap standard tiles with attribution and shows a usable list if tiles fail.

The Following feed orders posts chronologically and respects visibility. For You prioritizes a profile's chosen city and explicit filters. Trending is an initial rules-based hypothesis, not a validated recommendation model. Negative reviews remain in the score until a recorded moderation action hides them. Repeated reviews by one author do not amplify a venue's aggregate rating.

Public profile fields include name, username, bio, city, and initials. Emails and password material never appear in public API responses. Account deletion removes associated posts, comments, collections, hosted outings, invitations, sessions, and uploaded files. Moderator action rows and reports may retain an anonymous record with user references set to NULL.

This pilot is adult-only by self-declaration; that is not strong age assurance. No email provider, password recovery, automated evidence verification, antivirus/content scanning provider, cluster detection, payment provider, or production analytics service is connected.
