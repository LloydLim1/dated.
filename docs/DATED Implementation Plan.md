# DATED Implementation Plan

Delivery plan for the revised social discovery platform

Prepared 15 October 2026. Planning baseline: the revised concept with free consumer features, customer coins and vouchers, owner subscriptions, performance reports, and relevant location advertising.

## How to use this plan

Use this file as the implementation backlog. Follow the dependencies and phases in section 16, complete the work packages, and attach test evidence before checking off acceptance gates. An unchecked item describes planned work, not an existing implemented feature. Reuse current functionality where the baseline identifies it rather than rebuilding it.

The production work packages below remain the original delivery baseline. On 15 October 2026, the user confirmed that no cloud or payment projects were available and authorized completion using local storage. The corresponding local customer, business and operations features are now implemented; see [current implementation status and verification](revised-platform-implementation.md). Unchecked production gates still require hosted services and production-specific validation.

### Verification commands

Run the repository's existing checks as applicable to each change:

```powershell
npm run typecheck
npm run lint
npm run test:catalog
npm test
npm run build
```

Add focused PostgreSQL/RLS, wallet concurrency, voucher redemption, billing webhook and report fixture tests as those modules are implemented. Run tests against isolated data and provider sandboxes. Existing tests alone do not verify the new domains.

## 1 Delivery objective and scope

Extend the existing DATED pilot into a production platform. Customers discover places, share structured reviews, plan outings, and redeem earned coins for vouchers without a consumer subscription. Verified location owners subscribe for reports and additional exposure in clearly labeled placements that respect customer filters.

This plan covers implementation, migration, acceptance testing, operational readiness, and release. It does not treat the existing local pilot as production ready. Work is divided into a complete commercial pilot and a subsequent release completing the advanced free consumer features.

### Product commitments

| Area | Required outcome |
| --- | --- |
| Free B2C | Remove DATED Premium and Plus as paid products. Preserve existing features and make all planned consumer tools free. |
| Structured reviews | Predefine no more than five criteria per category; preserve older reviews without inventing missing scores. |
| Customer rewards | Customers earn coins from eligible reviews and spend them on vouchers, including offers from other places. |
| Paid B2B | Verified owners receive business reporting and filter-relevant promoted exposure through a subscription. |
| Location ads | Label sponsored placements, respect active filters, and separate paid visibility from organic scoring. |
| Trust | Reward positive and negative reviews equally. Subscription never controls customer ratings or moderation outcomes. |

### Planning assumptions

Use the existing Next.js and React app, migrate production data to Supabase PostgreSQL and protected Storage, retain MapLibre, and deploy a stateless application only after the local-store dependency is removed. These are implementation choices consistent with the repository's existing production direction, rather than services already connected.

Assume two full-time full-stack engineers, part-time product/design and QA support, and a business operations owner. Estimate 20 weeks to a commercial pilot and another 6 weeks to complete advanced consumer tools, plus 2 to 4 weeks of contingency. Re-estimate after the first two weeks. No launch date or provider spend is committed by this plan.

### Definition of complete

Every work package has a passing acceptance gate, deployed migrations, applicable access tests, operator instructions, and a rollback approach. Commercial pilot completion requires billing, reports, rewards, voucher redemption, and relevant ads to work end to end. Full concept completion additionally requires all advanced free features listed in section 7.

## 2 Existing implementation and required changes

The baseline below comes from repository inspection on 15 October 2026. Historical verification files document earlier tests; no application test suite was rerun for this planning task.

| Capability | Observed baseline | Implementation work |
| --- | --- | --- |
| Accounts and privacy | Local sessions, account export/deletion, visibility checks, moderation roles | Production identity, verified email, recovery, tenant roles, migration |
| Venue discovery | Metro Manila catalog, filters, MapLibre, stable place IDs and source metadata | Server-side criterion filters, branch reconciliation, production providers |
| Reviews | Four named criteria per category; integer scores; all existing criteria required | Versioned criteria, up to five, explicit not applicable, new aggregates |
| Review credibility | Latest eligible public review per account; incentivized reviews excluded | Separate platform rewards from merchant incentives; update scoring and tests |
| Social and outings | Feeds, photo journals, saved places, follows, consent-based shared outings | Preserve behavior through migration; complete group tools and insights |
| Itinerary designer | Free preview presented as Premium, snapshot sharing and exports | Rename and keep free; complete automatic planning and memory tools |
| Production storage | SQLite plus local files; Supabase is not connected | Async repositories, PostgreSQL, Storage, RLS and durable jobs |
| Commercial functions | No active B2B billing, wallet, vouchers, owner reports or ads | Implement these as new domains with auditable transactions |

### Repository change map

- `src/lib/types.ts`: separate API types from category definitions; introduce stable criterion IDs and domain types.
- `src/lib/review-credibility.mjs`, `src/server/read.ts`: centralize review eligibility, criterion aggregates, and reward disclosures.
- `src/server/validation.ts`: accept supported criterion versions and explicit not-applicable values; reject arbitrary fields.
- `src/server/db.ts`, `src/server/auth.ts`: introduce repository and identity boundaries before production migration.
- `src/app/api/[...path]/route.ts`: retain legacy compatibility while extracting domain handlers and adding explicit new routes.
- `src/components/dated-app.tsx`: split large consumer surfaces by feature without changing navigation behavior.
- `src/components/premium-studio.tsx`, `src/app/[view]/page.tsx`: rename the studio and redirect old Premium links.
- `supabase/`, `tests/`, `scripts/`: add migrations, access and transaction tests, migration tools, and operator jobs.

Preserve unrelated working changes already present in the repository. Update README, architecture, production instructions, and old Premium tests when the corresponding implementation ships.

## 3 Architecture and engineering foundations

Keep a modular monolith: one web application with separate domain services and a shared transactional database. Separate services do not require separate deployments at this stage.

### Application boundaries

| Layer | Responsibility |
| --- | --- |
| Consumer and business interfaces | Forms, navigation, accessible feedback, charts, and clearly labeled ads |
| Server routes and domain services | Identity, authorization, validation, reward decisions, billing entitlements, ad eligibility |
| Repository layer | Async reads and writes, transaction boundaries, stable domain interfaces |
| PostgreSQL and PostGIS | Authoritative records, constraints, spatial queries, ledgers, tenant policies |
| Protected object storage | Photos, private evidence, claim documents, generated private reports |
| Durable jobs | Report snapshots, expiries, rewards, catalog refresh, notifications, reconciliation |
| External adapters | Payments, email, production maps, scanning, monitoring and optional routing |

### Foundation work packages

- [ ] F01: Introduce server-only repositories for users, venues, reviews, outings, media, and collections. Replace direct synchronous database calls in a controlled sequence.
- [ ] F02: Add development, staging, and production configuration with separate credentials and fixtures. Keep privileged keys out of browser bundles and logs.
- [ ] F03: Add migration scripts, deterministic test seeds, schema checks, CI type/lint/build checks, and isolated database tests.
- [ ] F04: Introduce a transactional outbox and durable job table with unique keys, retries, backoff, leases, and a failed-job queue. A database commit creates its follow-up event in the same transaction.
- [ ] F05: Add shared request IDs, structured errors, audit records, pagination, rate limits, and feature flags.
- [ ] F06: Publish a common discovery filter contract used by normal results, maps, automatic plans, and sponsored eligibility.

### Production behavior

Use the installed Next.js guides as the authority for the installed version; the inspected package is 16.4.0. Keep authorization in server-only data access and domain services. Private wallet, billing, report, and evidence responses must not enter public or service-worker caches. Cache public aggregates separately and invalidate on review eligibility or subscription changes.

Use a scheduled worker or durable scheduler rather than relying on an application request to finish a background task. Avoid external provider calls while holding wallet or inventory locks. Choose connection pooling and worker hosting during the foundation spike and test the resulting deployment shape.

- [ ] **Acceptance gate:** a staging deployment reads production-shaped data through repositories, survives a restart, runs retryable jobs without duplicate effects, and exposes no privileged credentials to customers.

## 4 Data model and ownership

Use UUIDs for new internal entities while preserving existing public venue identifiers through aliases. Store money as integer centavos, coins as integer units, event timestamps in UTC, and customer visit dates as local dates. Business periods use Asia/Manila with explicit start-inclusive and end-exclusive boundaries.

| Domain | Main records and relationships |
| --- | --- |
| Identity | Profiles tied to auth users; consent records; organization memberships and role grants |
| Venues | Venues, branches, stable aliases, source records, source checks, factual edits and ownership claims |
| Reviews | Category versions, criterion definitions, reviews, criterion scores, revisions, disclosures, evidence and moderation |
| Social | Existing follows, posts, reactions, comments, collections, outings, stops and invitations |
| Rewards | Rule versions, reward claims, coin accounts, ledger entries, holds and account restrictions |
| Vouchers | Partner agreements, offer versions, branch eligibility, inventory, customer vouchers, redemptions and refunds |
| Business billing | Organizations, branch permissions, plans, provider customers, subscriptions, invoice references and webhook inbox |
| Advertising | Campaigns, approved creatives, targets, exposure allowances, delivery decisions and deduplicated events |
| Reporting | Event definitions, filtered events, daily aggregates, report snapshots, exports and delivery attempts |
| Operations | Outbox, job leases, audit records, support cases and configuration change history |

### Required constraints and indexes

- Unique review per author, branch and visit date, plus the existing outing-stop uniqueness. Cross-link reward claims so deletion and reposting cannot earn twice for the same eligible visit.
- Unique criterion within a category version and at most five definitions. Scores are 1 to 5 or explicit not applicable; unsupported criterion IDs fail validation.
- Unique reward claim per qualifying visit and rule scope; unique external event IDs and idempotency keys scoped to actor and operation.
- Unique redemption per customer voucher. Wallet ledger is append-only; a materialized balance must reconcile to the ledger.
- Organization and branch ownership on every business resource. Index membership checks, report periods, active subscription lookups, and pending jobs.
- Spatial index on known branch coordinates; indexes for category, city, public-review eligibility and aggregate lookups. Unknown coordinates remain null.

### Access boundaries

Customers read their own wallets and vouchers. Branch staff redeem only for assigned branches. Organization administrators manage their membership and billing. Analysts see authorized aggregate reports. Platform moderators assess content; finance and support permissions are separate. Owners cannot see private journals, private evidence, exact user location history, or other organizations' records.

RLS and database grants must both be tested. Privileged billing, reward, and redemption writes run through narrow server operations or restricted database functions; client users never directly edit balances or subscription status. Treat views and privileged functions as access boundaries too.

## 5 Production migration and venue continuity

The current SQLite schema and local media paths are pilot-specific. Setting Supabase environment variables does not migrate them. Convert the application and rehearse the transfer before switching production traffic.

### Migration sequence

1. Inventory tables, row counts, media, evidence expiries, catalog sources, itinerary documents, and share tokens. Create a consistent database-and-files backup with the current application paused for writes.
2. Implement asynchronous repositories against the local store first. Add a PostgreSQL implementation and run the same behavioral contract tests against both.
3. Create PostgreSQL migrations and Storage policies. Import a staging copy using stable old-to-new ID maps; retain public venue URLs and source identifiers.
4. Migrate identities through a tested supported process. If existing password hashes cannot safely transfer, require verified recovery or re-enrollment; do not assume Supabase accepts local hashes. Revoke old sessions at cutover.
5. Copy media with checksums and original visibility. Keep evidence private with its original remaining retention period. Import share snapshots with their revocation state.
6. Import reviews and their original criterion versions. Keep fictional/demo content visibly separated and excluded from commercial reports, rewards, and organic scores.
7. Reconcile counts, sampled relationships, score outputs, media permissions, source provenance, and deleted or expired records. Generate a migration exception report.
8. Rehearse cutover, then perform a short write freeze, final delta import, session reset, integrity checks, and smoke tests. Open writes only after acceptance.

### Venue identity and catalog work

Separate business organizations, physical branches, and provider records. A cinema screen or renamed museum must not accidentally become a new unrelated branch or receive a duplicate ownership claim. Review ambiguous merges manually and retain alias redirects. Claims attach to the actual operating branch.

Preserve catalog safeguards for incomplete imports, missing map listings, source country, unknown prices, and pending coordinates. Do not erase reviews when a provider stops listing a venue. Move directory refresh and source checking to hosted jobs and retain the current weekly refresh behavior.

### Recovery policy

Before the first production write, rollback can restore the old read/write pilot from its consistent snapshot. After new wallet, payment, or voucher transactions occur, stop affected writes and reconcile them before any rollback. Never restore an older database over accepted financial or reward transactions.

- [ ] **Acceptance gate:** two successful staging rehearsals, matching identity maps and permission checks, a working backup restore, and an operator-approved cutover and transaction reconciliation checklist.

## 6 Review criteria and score integrity

### New category definitions

| Category | Maximum five predefined criteria |
| --- | --- |
| Restaurant and café | Food and beverage quality; service; ambiance and comfort; cleanliness; value for money |
| Cinema | Screen and projection; sound; seating comfort; cleanliness; value for money |
| Museum and gallery | Exhibit quality; presentation and information; educational value; accessibility and visitor comfort; value for money |
| Park and outdoor attraction | Environment and scenery; cleanliness and maintenance; facilities; accessibility and comfort; value for money |
| Activity venue | Activity quality; staff assistance; equipment and facilities; cleanliness; value for money |

Launch the new restaurant/café, cinema, and museum versions first. Add other categories only with directory coverage and reviewed definitions. An active version has no more than five criteria; users can select not applicable. Require at least one scored criterion for a review, and propose at least three scored criteria plus a specific observation for reward eligibility. The reward threshold remains a configurable pilot decision.

### Review work packages

- [ ] R01: Store stable criterion IDs and versioned labels. Retain original scores and labels on old reviews. Map only clearly equivalent dimensions; do not split old Picture and sound into invented screen and sound scores.
- [ ] R02: Support not applicable in forms, APIs, and aggregates. Remove the current rule requiring every named criterion to have a score.
- [ ] R03: Compute each review's overall score from its scored criteria. Public venue scores use one latest eligible review per reviewer; criterion aggregates use that same selected review set and display the count for each criterion.
- [ ] R04: Use version-compatible criterion scores for filtering. Show insufficient data rather than substituting another dimension. Keep past overall scores explainable during the transition.
- [ ] R05: Split disclosures into platform coin reward, merchant benefit or complimentary visit, and business relationship. Legacy incentive flags become legacy merchant or unspecified incentives pending clarification.

### Resolve the existing reward conflict

Proposed scoring policy: DATED-funded platform coin rewards do not automatically exclude a credible public review from scores. Merchant-compensated or conflicted reviews remain visible with disclosure and excluded from organic scores under the current policy. Both decisions are server-owned and explained in the interface. Review this policy before enabling rewards; the existing single incentive flag cannot represent it safely.

No reward depends on sentiment. Hidden, private and demo reviews do not contribute to public aggregates. Latest-review weighting prevents repeat visits from multiplying one person's influence; shared outings remain deduplicated for independent-visit trending. Editing, hiding, deleting, changing visibility or restoring a review invalidates relevant aggregates and report snapshots under a versioned policy.

- [ ] **Acceptance gate:** legacy reviews remain readable; missing dimensions stay missing; rewarded positive and negative reviews receive equal treatment; new filters and displayed scores use identical eligibility rules.

## 7 Free consumer product completion

Remove Premium language, upgrade prompts and consumer entitlement checks. Rename the existing designer Itinerary Studio and redirect `/premium` to the new free planning route. Preserve saved designs, shared snapshots, print, calendar export and existing URLs through redirects.

| Work package | Deliverable and acceptance |
| --- | --- |
| C01 Discovery and comparison | Criterion sliders, price basis, occasion and radius filters; side-by-side venues; URL-restorable filters; unknown data never passes a selected threshold. |
| C02 Review and journal | New criteria, not applicable, voluntary photos, disclosures, reward preview and clear pending/rejected outcomes; private journaling remains usable without rewards. |
| C03 Wallet and vouchers | Balance and history, pending coins, catalog filters, offer terms, claim confirmation, customer code and redemption status. |
| C04 Shared outings | Preserve consent, multi-stop reviews, companions and privacy; clearly distinguish public experience content from private notes. |
| C05 Group planning | Collaborative lists, voting, budget allocation and expense splits with currency rounding and settlement notes; no money transfer service. |
| C06 Automatic itinerary | Rules-based suggestions within location, time and budget; manual edits; transport and opening-hours uncertainty disclosed. No AI dependency for launch. |
| C07 Personal insights | Spending trends, category and area breakdowns, annual recap with mutually approved tags; distinguish missing spending from zero. |
| C08 Memory tools | Exportable journals, enhanced scrapbook layouts, named collections and sharing controls; exports include only content the user may access. |

### Discovery and planning details

Standardize per-person and total outing budgets. When a user selects a total for two or a group, use a supported estimate with an explicit group size and display how it was calculated. Menu item prices and museum admission are not interchangeable with total estimated spending.

Automatic planning uses current venue candidates, visit durations, optional travel estimates, planned spending and user-selected start/end times. Return alternatives when constraints cannot be met. Keep route optimization and AI suggestions optional extensions; include a useful deterministic planner in the full free release.

### Accessible journeys

Review and voucher actions work with keyboard and screen readers. Supply list-based discovery when the map or device location fails. Preserve unfinished review text, show retryable errors, prevent double submission, and respect reduced motion. Check mobile, laptop and desktop layouts, long venue names, empty states and low connectivity.

- [ ] **Acceptance gate:** the free release checklist accounts for every former Premium capability and the advanced planning features. Features scheduled after the commercial pilot remain free when released; pilot delivery alone is not described as full concept completion.

## 8 Customer reward engine and coin accounting

### Eligibility and states

Create a reward claim when an authenticated customer submits a qualifying public review for a completed visit. Proposed pilot controls are verified email, at least three scored criteria, a specific written observation, one award per eligible visit, account/venue caps and duplicate checks. Exact coin rates, caps and waiting periods require pilot configuration approval. Photos and receipts remain voluntary.

Claims move through pending, approved, rejected or reversed states with an accessible reason and appeal route. Reward rules are versioned and recorded on every claim. Review creation and the claim/outbox event commit together; an unavailable worker leaves a visible pending state rather than losing the claim.

### Accounting implementation

- [ ] W01: Use an append-only integer coin ledger with earn, spend, refund and adjustment reasons and a linked source entity. A journaled correction references the original entry; administrators cannot silently edit balances.
- [ ] W02: Award coins once with a unique claim key. Retries, webhook duplicates, review edits, deletion and reposting cannot award again for the same visit.
- [ ] W03: Keep pending rewards outside spendable balance. Lock the account for a spend, validate balance and commit the debit with voucher issuance atomically.
- [ ] W04: Support wallet history, paginated statements and explainable rejection. Never allow client-provided award amounts or rule identifiers to authorize a grant.
- [ ] W05: Reconcile every account to ledger totals daily and alert on mismatches, duplicate effects or unexplained adjustments.

### Review changes and misuse

Before approval, a hidden, deleted or private review becomes ineligible. Proposed policy after coins vest: ordinary edits, privacy changes or deletion do not automatically claw back a legitimate award; the visit cannot earn again. Confirm this rule in the customer terms before release. Proven abuse can trigger an audited reversal and appeal.

If a fraudulent award has already been spent, restrict future spending and record a recovery balance; do not corrupt the ledger or silently create cash debt. Refund or re-credit rules must account for that recovery balance. Completed merchant redemptions remain part of reconciliation.

Customers cannot buy, transfer or cash out coins. Do not introduce coin expiry in the pilot without an explicit disclosed policy and tested expiry accounting. Customers can continue using the app without opting into rewards.

- [ ] **Acceptance gate:** concurrent awards remain single awards; concurrent spending cannot overdraw; every displayed balance reconciles; the same eligible positive or negative review earns the same configured amount.

## 9 Voucher inventory and redemption

### Offer setup

Operations approves a participating partner and records who funds the discount, participating branches, stock, minimum spend, benefit, coin cost, dates, exclusions, redemption instructions and cancellation treatment. Store an immutable offer snapshot on each issued customer voucher so later edits cannot change an existing promise.

Start with partner-funded discounts and a limited catalog. Any DATED subsidy has a separately approved budget and settlement record. Customer coins can obtain offers from places other than the venue reviewed. A business subscription expiring does not invalidate already issued vouchers or prevent staff from honoring them.

### Transaction flows

1. The customer previews full terms and confirms. The server validates offer dates, branch eligibility, account restrictions and idempotency key.
2. In one database transaction, lock account and offer inventory in a consistent order, check available coins and stock, debit coins, decrement stock and create the issued voucher.
3. Return a high-entropy single-use token or QR representation. Store a hash of the redeemable secret; avoid including personal data or balances in the code.
4. Branch staff authenticate and scan or enter the token. Preview eligibility, expiry and applicable branch before confirming.
5. Atomically move issued to redeemed, record staff and branch, and return a receipt. A repeat request with the same key returns the original result; another redemption fails safely.

### State and exception handling

Offers move from draft through approved/active to paused or ended. Customer vouchers move from issued to redeemed, expired or cancelled. A cancelled voucher with a refund produces one linked ledger credit. Expiry does not automatically refund under the proposed default; partner cancellation or failure to honor triggers support review and a defined remedy.

If a claim transaction fails, neither stock nor coins changes. If the transaction succeeds but the response is lost, retry returns the same issued voucher. If a partner closes or withdraws, pause new issuance and process outstanding vouchers using the agreed cancellation terms. Existing voucher status remains visible after subscription expiry.

Do not support offline final redemption in the pilot because it cannot reliably prevent reuse. Provide a code-entry alternative and a clear connection error without marking the voucher used.

- [ ] **Acceptance gate:** a race for the last voucher issues exactly one; wrong-branch and repeat redemption fail; refunds occur once; staff can honor outstanding valid vouchers even when new promotions are paused.

## 10 Business accounts and subscriptions

### Claiming and managing a location

- [ ] B01: Create an organization and request a branch claim. Use verified business contact methods or privately reviewed supporting documents. Track pending, approved, rejected, disputed and revoked claims.
- [ ] B02: Verify ownership before granting paid management access. Resolve duplicate claims through operations; paying alone never establishes ownership.
- [ ] B03: Add owner, organization administrator, analyst and branch redemption-staff permissions. Invite membership through expiring tokens; audit transfers, removals and role changes.
- [ ] B04: Expose branch profile corrections, reporting, subscription management, ad configuration, and approved voucher operations as separate permissions.

### Subscription and payment implementation

Use one monthly business plan initially with an explicit branch allocation, report access and promoted exposure allowance. Price, taxes, trial rules, included locations, renewal behavior and grace period are business decisions to confirm. Support multi-branch organizations without assuming every branch is paid.

Build a payment-provider adapter for checkout, subscription retrieval, cancellation, invoices, signed webhook verification and reconciliation. PayMongo is a candidate with a documented subscription API; confirm merchant eligibility, supported recurring methods, fees and sandbox behavior before selection. If automatic renewal is unavailable, expose an accurately labeled manual-renewal plan rather than simulated recurring billing.

Subscriptions move through pending, active, past due, cancel-at-period-end, cancelled or expired states. Derive branch entitlements from verified provider state and effective timestamps. A checkout return URL or browser success flag never activates reporting or ads.

### Webhook and lifecycle controls

- Verify signatures against the raw request body in a dedicated provider route, with provider-specific replay controls. Do not apply customer-session or browser-origin requirements to legitimate provider callbacks.
- Persist the unique provider event before processing; acknowledge safely, retry through jobs and reject invalid signatures. Process provider events without duplicate grants.
- Handle out-of-order events by retrieving authoritative state or comparing provider versions. Reconcile daily and before resolving billing disputes.
- On expiry or immediate termination, stop new paid placements and paid report access at the effective time. Keep basic venue information, independent reviews and outstanding voucher redemption available.
- Maintain a transparent billing page with current period, next renewal, receipts, cancellation and payment recovery. Changes to access must be explained.

- [ ] **Acceptance gate:** sandbox payment, renewal, failed payment, cancellation, recovery, duplicate event and delayed event scenarios produce the correct branch entitlements without exposing another organization's billing data.

## 11 Location ads and relevant exposure

### Eligibility before promotion

Implement one server-side filter engine for normal discovery and sponsored candidates. Apply category, city/radius, budget basis and group size, occasion tags, criterion thresholds and minimum evidence rules first. Unknown price, missing coordinates or insufficient criterion data cannot satisfy a filter requiring that information.

After filtering, select promoted candidates only from verified branches with active paid entitlements, an approved active campaign, available exposure allowance and no safety or venue-status exclusion. Recheck at response generation; client filters alone are insufficient. If nothing qualifies, leave the placement empty or return ordinary results.

### Ad work packages

- [ ] A01: Campaign editor with venue, truthful creative, schedule, placement choices and permitted targeting. Owners cannot target private outing details, evidence or sensitive inferred traits.
- [ ] A02: Moderator approval, pause controls and a change history. Edits to material claims or creative require reapproval.
- [ ] A03: Sponsored positions in Explore, Home recommendations and map/list discovery. Show Sponsored on the card or map treatment and retain the actual venue score.
- [ ] A04: Relevance-based selection with fair rotation, deduplication and configurable exposure caps. Initial proposal: at most one sponsored result per five organic list items and no more than one from the same branch per page. Validate these limits during usability testing.
- [ ] A05: Server-issued delivery IDs and deduplicated exposure/click events linked to the actual filter context. Ignore self-traffic, known bots and test accounts.
- [ ] A06: Shared card accessibility, clear destination, report-ad action and list fallback. Labels remain visible on small screens.

### Measurement and safeguards

Record served placements separately from qualified visible impressions. Proposed visible-impression definition is at least half the ad visible for one continuous second, once per delivery ID; visibility signals are best-effort and subject to abuse checks. Billing is subscription-based initially, not per click or per impression.

Exposure is additional eligibility for relevant sponsored appearances, not a promise of fixed impressions or sales. Rotate fairly among qualifying subscribers and explain limited exposure when filters, missing data or inventory restrict eligibility. Organic ordering, venue scores, trust indicators and moderation stay independent of payment.

Use short-lived delivery decisions and server-side entitlement checks so expired subscriptions stop receiving new ads. If ad delivery or tracking fails, normal discovery continues. Budget filters must consistently distinguish per-person estimates, total outing budgets and sourced menu prices.

- [ ] **Acceptance gate:** a promoted venue can never bypass an active filter; unknown data does not pass; ordinary results still work with ads disabled; subscription expiry, campaign pause and unsupported coordinates remove new paid placements.

## 12 Owner reports and event measurement

### Report scope and definitions

| Report | Definition and implementation |
| --- | --- |
| Experience quality | Criterion averages, score distribution, reviewer counts and period change using published eligibility/version rules |
| Feedback themes | Repeated strengths and complaints linked to eligible public reviews; include conflicting views and sample counts |
| Discovery | Venue opens, saves, directions requests and outing inclusions; separate events from unique actors |
| Context | Aggregated reported spending and occasion suitability; unknown spending excluded from spending statistics |
| Advertising | Served placements, qualified impressions, clicks and click-through rate; paid and organic activity separate |
| Vouchers | Claimed, redeemed, expired, cancelled and outstanding vouchers; cohort and period definitions explicit |
| Improvement | Comparable periods and actions logged by owners; no claim that an action caused a rating change |

### Reporting work packages

- [ ] D01: Define event schemas before new journeys ship. Include event ID, UTC time, branch, type, permitted pseudonymous actor/session, source and optional campaign or voucher reference.
- [ ] D02: Validate and deduplicate client events; generate authoritative business events on the server. Avoid collecting raw precise user coordinates, private notes or review text in analytics payloads.
- [ ] D03: Build daily aggregates and monthly report snapshots with job retries, data-through timestamps and calculation versions. Financial, wallet and voucher totals come from their authoritative records, not client analytics.
- [ ] D04: Build an owner dashboard with date range, branch selector, score counts, comparisons, ad and voucher views, and empty/low-data states. Add CSV and printable report exports with the same permissions.
- [ ] D05: Deliver monthly report notifications to opted-in authorized business contacts. In-app reports remain the source of truth when email fails. Expiring links require authorization.
- [ ] D06: Start feedback themes with traceable rules and moderation review. An optional later summarizer must cite source reviews, resist instructions embedded in review text, and preserve conflicting evidence.

### Accuracy and privacy rules

Use period-created eligible reviews with at most one selected review per reviewer per branch for period experience statistics; explain differences from the venue's all-time latest-review score. Criterion filters continue to use the public venue aggregate. Compare equal-length periods and identify category-version breaks.

Propose suppression of contextual breakdowns below five distinct reviewers, with a minimum cohort fixed per report and controls against identifying people through repeated narrow queries. Label this a privacy floor, not statistical confidence. Owners can read already-public reviews but cannot export private customer histories.

Click-through rate equals valid clicks divided by qualified impressions in the same period. Voucher cohort redemption rate equals redeemed divided by issued vouchers in the defined cohort; period redemptions are a separate measure. Directions requests, saves and voucher claims are not proof of physical visits or sales.

- [ ] **Acceptance gate:** fixed fixtures reproduce report numbers, cross-tenant exports fail, low-data groups stay suppressed and every displayed metric has a documented denominator, time period and source.

## 13 Routes and service contracts

The following contracts are planned implementation boundaries. Preserve existing compatible endpoints while extracting new domains from the large catch-all handler. Publish request/response schemas and machine-readable error codes before connecting clients.

| Domain | Proposed routes and authorization |
| --- | --- |
| Categories and discovery | GET `/api/categories`, GET `/api/discovery`; validated filters and public-safe data |
| Reviews | POST `/api/reviews`, PATCH/DELETE `/api/reviews/:id`; author or authorized moderation action |
| Wallet | GET `/api/wallet`, GET `/api/wallet/entries`; current customer only |
| Vouchers | GET `/api/vouchers`, POST `/api/vouchers/:id/claim`, GET `/api/my-vouchers`; authenticated claim and owner-only issued codes |
| Redemption | POST `/api/business/redemptions/preview`, POST `/api/business/redemptions/confirm`; assigned branch staff |
| Organizations and claims | POST `/api/business/organizations`, POST `/api/business/claims`, membership routes; scoped owner/admin |
| Billing | POST `/api/business/billing/checkout`, GET `/api/business/billing`, POST cancellation; billing administrator |
| Provider callbacks | POST `/api/webhooks/billing/:provider`; provider signature, no browser session requirement |
| Ads | Campaign management under `/api/business/campaigns`; approved tenant members; server-selected discovery delivery |
| Analytics | POST `/api/events`; allowlisted event types, delivery references, size and rate limits |
| Reports | GET `/api/business/reports`, POST report export; active subscription and authorized branch scope |
| Operations | Restricted claims, rewards, offers, campaigns, moderation and reconciliation tools under `/api/admin` |

### Shared contract rules

- Use server-derived actor and tenant identity. Ignore client-supplied owner IDs, balances, subscription status and reward outcomes.
- Require an idempotency key for claim, redemption, billing initiation and administrative credit/refund operations. A repeated key with different payload returns a conflict.
- Use cursor pagination and stable ordering for reviews, wallet history, events and reports. Do not extend the pilot's bounded bootstrap response to include all business data.
- Return consistent validation, unauthorized, forbidden, conflict, rate-limit and temporary-failure responses. Include a support request ID without leaking private records.
- Separate public cacheable reads from private no-store responses. Revalidate authorization for report downloads and voucher codes; sharing a URL is insufficient.

### Important transactional boundaries

Review and reward-request creation are atomic. Coin debit, offer stock and voucher issuance are atomic. Voucher redemption and its audit event are atomic. Provider event storage and entitlement application are retry-safe. Report generation is repeatable by branch, period and version rather than creating unlimited duplicate snapshots.

- [ ] **Acceptance gate:** endpoint contract tests include retries, stale clients, unauthorized tenant IDs, unknown criteria, malformed tokens, interrupted responses and safe error handling.

## 14 Administration and operational readiness

### Operator tools

Provide queues for ownership claims and disputes, reported reviews, reward appeals, suspicious reward activity, voucher offers, rejected redemptions, ad approval, payment reconciliation and failed jobs. Each decision records actor, timestamp, reason and affected record. Sensitive adjustments require an appropriately scoped role and additional confirmation inside the operator tool.

### Security and privacy work packages

- [ ] O01: Verified email and recovery; secure sessions; stronger authentication for business owners and privileged operators; session revocation after role changes.
- [ ] O02: Tenant access and database-policy tests for consumers, followers, invitees, owners, staff, analysts, moderators and finance operators.
- [ ] O03: Upload validation, bounded decoding, metadata removal, malware/content scanning, private evidence and claim-document delivery, and retention workers.
- [ ] O04: Rate limits and fraud checks across account, reward, claim and redemption activity. Review suspicious groups without treating a shared outing as proof of fraud.
- [ ] O05: Published privacy, reward, voucher, business billing and advertising terms; operator/support contacts; consent and analytics choices. Obtain local legal/accounting review of payments, retention and rewards before commercial release.
- [ ] O06: Account deletion and export workflows covering new records. Remove public content and unnecessary personal data while retaining only justified pseudonymized audit/accounting records under an explicit retention schedule.

### Monitoring and recovery

Alert on elevated errors, failed payments, billing webhook lag, stale entitlements, wallet mismatches, stock discrepancies, unusual award spikes, failed redemptions, report delays and catalog failures. Exclude secrets, voucher codes, claim documents and exact user locations from logs.

Proposed recovery objectives are a maximum one-hour data-loss window and four-hour service restoration; select a database backup/PITR option and media strategy that can actually meet them. Rehearse restoration and compare wallet, voucher and billing reconciliation before reopening transaction writes. These are targets to validate, not existing guarantees.

### Independent shutdown controls

Use separate feature flags for coin awarding, coin spending, new voucher issuance, new ad delivery and checkout. Where safe, keep existing voucher redemption, wallet history, ordinary reviews and consumer discovery available during a partial incident. Never clear the ledger or revoke valid vouchers simply to reset a failed rollout.

- [ ] **Acceptance gate:** an operator can pause each new commercial function, diagnose a failed job, resolve an appeal, restore a backup and reconcile transactions using documented procedures.

## 15 Test strategy and release evidence

Run focused tests as each domain is implemented, then a complete regression before release. Reuse the current Playwright and catalog suites rather than replacing working coverage. Add database integration tests against the actual PostgreSQL policies and transactions.

| Test group | Required scenarios |
| --- | --- |
| Reviews and filtering | Old criterion versions; not applicable; missing scores; reward versus merchant incentives; latest-review selection; unknown prices; total budgets; filter consistency |
| Wallet correctness | Duplicate award; parallel spend; lost response; rule changes; pending/rejected claims; reversal after spending; reconciliation |
| Vouchers | Last-stock race; wrong branch; reused or forged token; expiry boundary; cancellation/refund once; partner shutdown; subscription expiry |
| Billing | Valid/invalid signature; replay; out-of-order events; successful renewal; failed payment; cancellation; daily reconciliation |
| Ads | Every active filter; sparse data; no eligible subscribers; disclosure; rotation; expired entitlement; paused creative; deduplicated events |
| Reports | Metric fixtures; period boundaries in Manila; version breaks; late events; low samples; paid/organic separation; export authorization |
| Privacy and security | Cross-tenant access; direct object URLs; removed staff; private evidence; follower/companion consent; account export/deletion |
| Existing app | Accounts, feeds, maps, catalog imports, journals, collections, shared outings, snapshots and old Premium redirects |

### Browser and performance checks

Exercise the full journey: discovery, venue view, review submission, pending award, awarded coins, voucher claim, staff redemption, owner report and relevant ad appearance. Include a negative review that receives the same reward. Exercise mobile, laptop and desktop layouts, denied location, keyboard-only use, screen-reader checks and reduced motion.

Proposed staging targets: p95 indexed discovery response under 800 ms and voucher issue/redemption response under 1.5 seconds at 100 concurrent active sessions, excluding external checkout. Define test workload, database size and network assumptions with results. Track page responsiveness and real-device performance separately. Adjust infrastructure or scope if these targets fail.

### Required evidence

Save CI results, database access tests, concurrency and retry results, report fixture comparisons, accessibility review, load results, migration reconciliations and backup-restore logs. Run type checking, lint, relevant tests and production build. Test fixtures and fake payments stay isolated from real accounts and reports.

**Release gate:** no known critical authorization, ledger, redemption, payment or privacy defects; all core journeys pass; an operator rehearses the incident procedure. Passing historical pilot tests does not satisfy the new commercial release gate.

## 16 Delivery schedule and dependencies

The schedule is a planning estimate for two full-time engineers with product, design, QA and partner support available. It assumes reuse of the existing app. Weeks are relative to project start; provider onboarding and partner agreements can extend the critical path.

| Phase | Weeks | Owner and work packages | Exit milestone |
| --- | --- | --- | --- |
| P0 Decisions and design | 1 to 2 | Product/UX, tech lead, operations; policy register, journeys, provider spikes | Rules and contracts agreed; backlog re-estimated |
| P1 Production foundation | 3 to 6 | Both engineers; F01 to F06 and migration foundations | Staging on PostgreSQL; identity/storage access tests pass |
| P2 Reviews and free rebrand | 7 to 8 | Engineers and QA; R01 to R05, C01/C02, free studio | Versioned review migration and filter rules pass |
| P3 Rewards and vouchers | 9 to 11 | Engineer A, QA and partners; W01 to W05, C03, voucher flows | Concurrent award/claim/redemption tests pass |
| P4 Business and billing | 9 to 14 | Engineer B, operations; B01 to B04, billing adapter and lifecycle | Verified owner can pay and manage authorized branches |
| P5 Ads and reports | 15 to 17 | Both engineers and QA; A01 to A06, D01 to D06 | Relevant ads and auditable reports work end to end |
| P6 Hardening and pilot | 18 to 20 | Entire team; O01 to O06, migration, tests, launch | Commercial pilot gate passes |
| P7 Complete free tools | 21 to 26 | Engineers, UX and QA; C04 to C08 remaining scope | Group tools, planner, analytics and memory features complete |
| Contingency | 2 to 4 extra | Reserved for defects, provider delays and pilot findings | Full concept release after all gates pass |

### Critical dependencies

Foundation and identity precede tenant permissions and authoritative transactions. Versioned reviews and scoring policy precede coin awards and criterion-based ad eligibility. Partner terms and usable voucher stock precede spending. Verified billing state precedes paid ads. Event definitions start in P1, even though reporting screens arrive later.

Owner claims, payment onboarding, partner recruiting and terms drafting begin in P0 and continue alongside engineering. No commercial release opens simply because an engineering phase reaches its estimated week.

### Delivery management

Use two-week iterations with a demonstrable customer or operator journey each time. Turn each work package into a tracked issue with acceptance criteria, dependencies, owner, migration needs and test evidence. Reforecast at P0 exit, P2 exit and after the first partner redemption rehearsal. A single-engineer team needs a substantially longer schedule; do not treat this as a fixed-date promise.

## 17 Pilot rollout and business validation

### Release stages

1. Internal staging: fictional users and venues, payment sandbox, test coins and test vouchers. Confirm all approvals, ledgers, privacy rules and reports.
2. Partner rehearsal: suggested starting cohort of 5 to 10 verified locations and 30 to 50 invited adult customers in one concentrated area. Verify staff training, connectivity and real voucher terms before public claims.
3. Controlled commercial pilot: enable paid subscriptions and limited funded inventory only after payment and redemption readiness. Monitor daily for at least two reporting cycles before broad expansion.
4. Wider release: expand by neighborhood and category when operations, data quality, usable vouchers and partner retention support it. Finish the advanced free feature checklist before calling the entire revised concept implemented.

### Success measures and review cadence

| Area | Measure and decision use |
| --- | --- |
| Customer usefulness | Review completion, returning contributors, saved places and criterion-filter use; compare with the pilot baseline |
| Rewards | Approved claims, spendable coins, redemption, pending age, fraud and support rates; pause expansion if stock or funding cannot support demand |
| Business value | Report usage, owner actions, paid activation and renewal; interview owners about usefulness rather than treating clicks as sales |
| Ads | Eligible delivery, impressions, clicks, filter violations and ad complaints; zero known filter bypass is a release requirement |
| Reliability | API errors, reconciliation discrepancies, failed redemptions and reporting delays; every financial mismatch is investigated |

Set commercial targets after baseline measurement and owner interviews. Product adoption percentages are hypotheses, not technical launch gates. Review daily during initial rollout, weekly with partners and monthly for subscription and reporting decisions.

### Budget and unit economics

Build a monthly budget covering labor, application hosting, database/backup, media storage and delivery, maps/routing, email, scanning, monitoring, payment fees, support, moderation and rewards. Obtain current provider quotes before commitment; no unverified peso pricing is assumed here.

Monthly contribution equals collected business subscription revenue minus payment costs, operating services, attributable support/moderation, and DATED-funded voucher benefits. Track taxes/refunds separately with accounting guidance. Break-even paying branches equal fixed monthly costs divided by positive average contribution per branch.

Report issued and outstanding vouchers, partner funding obligations and the demand represented by unspent coins separately. Coins have no automatic peso cash value. Test low subscription adoption, high voucher use and provider-cost spikes before expanding award rates.

## 18 Decision register and launch checklist

The product direction is established. The following operating choices are proposed implementation details that need resolution before their dependent work ships.

| Decision | Responsible party | Needed before |
| --- | --- | --- |
| Coin rate, caps, qualifying criteria and waiting period | Product and operations | Reward engine enabled |
| Platform-reward scoring and legacy disclosure mapping | Product and trust lead | Review migration finalized |
| Privacy changes, reversals, expiry and appeals | Product, operations and legal reviewer | Customer reward terms published |
| Voucher funding, cancellation and partner settlement | Partner operations and finance | Any redeemable offer listed |
| Business price, branch allocation, renewal and grace | Product and finance | Checkout opened |
| Payment provider eligibility and recurring method | Tech lead and finance | Billing implementation committed |
| Ad frequency, exposure allowance and approval rules | Product and operations | Subscriber ads enabled |
| Report sample floor, retention and event choices | Product, privacy reviewer and tech lead | Analytics/report collection opened |
| Hosted providers, budget, recovery and support owner | Tech lead and project owner | Production cutover |

### Commercial pilot launch checklist

- Verified owners, tenant isolation and real billing lifecycle pass; access does not depend on a checkout redirect.
- Public review scores explain platform rewards, legacy criteria and missing data; private content stays private.
- Coin balances reconcile; duplicate/retry/concurrency tests pass; no award amount is trusted from the browser.
- Real voucher offers have funding, stock, trained staff and cancellation rules; outstanding vouchers survive subscription expiry.
- Sponsored results respect every active filter, carry visible labels, and stop when the effective entitlement ends.
- Reports have correct periods, counts and denominators, separate paid activity, and enforce branch permissions.
- Migration, restore drill, provider monitoring, independent feature shutdowns and support procedures pass.
- Free consumer access, existing journals/outings, source attribution and working legacy links are preserved.

### Full implementation completion checklist

Complete C01 to C08, including free advanced comparisons, deterministic itinerary suggestions, group voting and budgets, expense tracking, personal analytics, annual recaps, scrapbook layouts and journal exports. Verify all commercial pilot controls still pass after these additions. Update product documentation and obtain final product acceptance against the revised concept.

### First implementation iteration

Start with the decision register, branch identity design, repository interfaces and criterion-version mapping. Build one vertical staging journey covering a real category review and safe aggregate update before adding wallet value. Open partner onboarding and payment-provider eligibility checks in parallel with this foundation work.

## 19 References and planning evidence

### Local product and implementation evidence

- `docs/DATED Revised Concept.docx`: product scope, rewards, business reports and relevant location advertising.
- `README.md`, `docs/architecture.md`, `docs/production-plan.md`, `supabase/README.md`: pilot behavior, local storage, existing production boundaries and deferred features.
- `src/lib/types.ts`, `src/server/validation.ts`: existing categories, four-criterion definitions and review validation.
- `src/lib/review-credibility.mjs`, `src/server/read.ts`: incentive exclusion and current public score calculations.
- `src/server/db.ts`, `src/server/auth.ts`, `src/app/api/[...path]/route.ts`: local persistence, sessions, authorization and catch-all API coordination.
- `src/components/dated-app.tsx`, `src/components/premium-studio.tsx`, `src/app/[view]/page.tsx`: existing consumer navigation and free Premium preview.
- `tests/`, `docs/verification.md`: existing automated coverage and historical verification; these are not fresh release results.

### Installed framework guidance

Read from the installed Next.js package before planning changes: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `01-app/02-guides/data-security.md`, and `01-app/01-getting-started/17-deploying.md`. Recheck applicable local guides as implementation proceeds because package conventions may differ from older versions.

### Official external implementation references

- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase PostGIS: https://supabase.com/docs/guides/database/extensions/postgis
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- PayMongo subscription API: https://docs.paymongo.com/reference/subscriptions

External references were checked on 15 October 2026 for architecture and payment-provider evaluation. Provider capability documentation does not establish merchant approval, production configuration, pricing, or completed integration. Recheck account-specific requirements during implementation.

### Planning status

This Markdown file preserves the production implementation baseline. The [local implementation record](revised-platform-implementation.md) supersedes its historical feature baseline. Production migration, provider-specific billing/email, hosted deployment, RLS and public-launch acceptance gates remain open; local test results must not be interpreted as proof of those integrations.
