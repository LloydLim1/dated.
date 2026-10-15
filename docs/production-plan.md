# Production implementation and launch gates

The user objective recommends Next.js, Supabase, PostgreSQL/PostGIS, protected object storage, MapLibre, and Vercel. The finished local pilot establishes the journeys and domain boundaries. The following work remains before it becomes that production architecture.

## Supabase and Vercel

1. Provision separate development/staging/production Supabase projects. Keep service-role credentials server-only. Connect Supabase Auth with verified email, recovery, session revocation, and OAuth only if desired.
2. Replace the local store with asynchronous repositories for PostgreSQL. Use UUIDs tied to `auth.users` for profiles, normalize category definitions and review ratings, and keep provider-owned venue data in `place_sources` separately from Dated attributes.
3. Enable PostGIS, store branch coordinates as geography, and create a GiST index. Run radius queries on the server, retaining manual city fallback. Never store user location in public reviews.
4. Enable RLS on every user-content table, plus protected Storage policies. Re-run the current authorization tests directly against RLS with public, author, follower, unrelated-user, invited-user, accepted-user, and moderator JWTs.
5. Implement server-issued media upload paths with signature/size/dimension checks, malware/content scanning, private evidence access, a 30-day retention worker, and private/signed delivery for restricted review photographs. An anonymous public image bucket is unsuitable for private review photos.
6. Keep moderation membership outside client-editable profile fields. Use trusted functions for companion invitations and transactional outing/review writes. Invited users alone can accept; hosts must never write their consent status.
7. Replace bounded bootstrap reads with cursor APIs and indexed ranking aggregates. Keep one contributor's repeated reviews from amplifying a venue and group shared outing stops into independent events.
8. Connect the converted repositories and auth/storage services to the existing surfaces, then deploy the stateless Next.js app to Vercel. Setting environment keys without this repository conversion is insufficient.

Official references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage policies](https://supabase.com/docs/guides/storage/security/access-control), [private bucket behavior](https://supabase.com/docs/guides/storage/buckets/fundamentals), and [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).

## Curated pilot content

Replace every fictional place with a verified branch listing, current address, licensed photos, contact/source metadata, and accurate hours. Collect independent reviews from consenting real users. Do not relabel the sample contributors or sample stories as actual community activity. Start with a manageable Metro Manila area, then expand based on usefulness and returning users.

## Operations and trust

Connect monitoring, an email provider, and structured product metrics. Establish moderation staffing, support contacts, report escalation, privacy/operator details, verified retention procedures, recovery drills, and a privacy impact assessment. Add rate limits at the edge, bot mitigation, upload quotas, coordinated-activity detection, and suspicious-review review queues. Self-declared age is insufficient for public age assurance.

Test search-to-view, view-to-save, review completion, outing completion, returning users, authorization, peak load, accessibility, real mobile networks, recovery, and incident handling using the curated dataset.

## Local implementation and remaining connections

The revised local implementation includes free deterministic itinerary generation, expense splitting, voting, customer coins/vouchers, business workspaces, reports and relevant advertising. DATED Premium has been removed as a customer product. See [implementation status](revised-platform-implementation.md).

Online subscription payments, verified email/recovery, hosted data/storage, production monitoring and native apps remain external work. Local business subscriptions activate only after an administrator records verification of a real manual payment reference. A browser redirect never grants a paid entitlement. No cloud projects were available; the user explicitly chose to continue the local implementation.
