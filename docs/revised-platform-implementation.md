# DATED revised platform — local implementation

Implementation date: 15 October 2026. The user confirmed that no Supabase or payment-provider projects exist and chose to continue locally. This release uses persistent SQLite, local media and local sessions. Customer features have no subscription requirement. The production backlog remains in [DATED Implementation Plan.md](DATED%20Implementation%20Plan.md).

## Run and navigate

Requires Node 22.19+ and the existing dependencies:

```powershell
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Create separate customer, owner and operator accounts to try the complete journeys. No default passwords, funded wallets, paid subscriptions or commercial offers are shipped.

Desktop destinations include Coins & vouchers, Planning studio and For businesses. On mobile, open **More** for these destinations. An administrator also sees **Platform operations**. `/premium` redirects to `/planning`.

Promote an account you already registered into the local operator role:

```powershell
npm run admin -- your-registered-email@example.com
```

This local role includes content moderation and commercial operations. Separate finance/support staff roles remain a production refinement.

## Customer journey

1. Explore real locations with category/city/query, occasion, budget, group-size/budget-basis, overall/criterion rating and reviewer-count filters. Unknown prices or scores do not pass selected thresholds. Compare two venues and copy a search link. Exact device coordinates are excluded from those links.
2. Review a completed visit using at most five category criteria; mark a criterion not applicable when needed. Historical four-criterion reviews retain their original labels. Old combined cinema dimensions are not split into invented scores.
3. Opt into contribution coins on an independent public review. Default eligibility is at least three scored criteria and 40 characters of specific experience text. The default award is 20 coins, capped at five approved reviews per Manila calendar day. Positive and negative reviews receive the same amount. Private, merchant-compensated, fictional/sample and business-affiliated contributions do not earn coins. Duplicate visit/text checks and server decisions apply.
4. Open **Coins & vouchers** for pending claims, balance and ledger history. Rejected/reversed awards have reasons and an appeal route. Platform coins are distinct from merchant benefits and do not automatically exclude an otherwise eligible review from public ratings.
5. Choose a partner offer, read its minimum spend, stock, expiry and terms, then confirm spending coins. The voucher can be for a different place from the review. A transaction checks balance and inventory together; retry keys cannot create a second debit. Display the private code to authorized venue staff.
6. View used/expired vouchers and the original terms saved when issued. Issued vouchers remain redeemable after the business subscription ends. Operators can cancel an unused voucher and refund its coin cost with an audit reason.
7. Use **Planning studio** for deterministic outings within a total group budget and available time, manual itinerary editing, private saves, revocable snapshots, print/PDF and calendar exports. Travel durations are rough walking estimates; opening hours and prices need confirmation.
8. Invite companions and wait for acceptance. Shortlist venues, vote, let the host adopt a suggestion, allocate budgets, record expenses and inspect exact-centavo settlement suggestions. DATED does not transfer money.
9. Open private journal insights for yearly/all-time totals, spending trends, categories/cities, journal/scrapbook layouts and Markdown/JSON export. Missing spending stays distinct from zero. Saved collections remain private unless the owner creates a snapshot link. Revoke or replace the link at any time; private reviews, notes and profile details are excluded.

## Business and operator journey

1. A registered owner creates a business workspace and submits a claim for an existing real location, with contact and verification evidence. The operator reviews the evidence and records an approval/rejection reason. A branch cannot belong to two workspaces. Fictional sample venues cannot be claimed.
2. Verified owners/managers maintain owner-provided descriptions, hours, estimated spending and occasion tags. Source information remains distinct from owner-provided estimates.
3. The owner requests an invoice. The configurable local default is **PHP 499 for 30 days**. This is a pilot configuration, not an approved final pricing decision. The invoice does not activate access. An operator records verification of an actual manual payment reference to activate the period. Cancellation preserves access until the recorded end; renewal requires another verified invoice. No card or online checkout is connected.
4. Reports show real independent reviewer samples, criterion averages with counts, previous equal-period reviewer comparison, recurring keyword mentions linked to actual feedback, organic activity, sponsored impressions/clicks/CTR and voucher cohort redemptions. Spending context is suppressed below five contributing observations. Keyword counts are descriptive, not generated sentiment claims. CSV export contains the selected report period.
5. The persistent local worker archives the previous complete Manila calendar month once for active verified branches. Snapshots are stored in `report_snapshots`; on-demand reports are calculated from current eligible data. No email delivery is configured.
6. Submit a campaign for operator review. Only an active subscription and approved campaign can receive labeled sponsored exposure, and the venue must pass the same discovery filters as organic results. One sponsored placement is returned per request, with per-viewer cooldown and campaign delivery caps. Payment does not alter organic ratings or moderation decisions.
7. Submit partner-funded voucher offers with stock, coin cost, benefit, validity, minimum spend and immutable issue terms. Operators verify funding/terms before publication. Owners/managers may pause new claims; existing vouchers keep their terms.
8. Invite registered teammates. Managers may manage assigned branches, analysts may read assigned reports and staff may redeem only at their assigned branch. Invitees accept from their wallet. Owners manage billing and membership. Access checks run on the server, independently of hidden UI controls.
9. Staff preview a customer code, verify its terms and confirm redemption. A second confirmation is rejected. An expired subscription does not prevent honoring an already-issued valid voucher.
10. Owners can transfer ownership to an accepted teammate. Closing a workspace requires the exact business name and resolution of outstanding valid vouchers. Closure stops ads/offers/access and releases claims without erasing historical transaction records.

Platform operations includes ownership/payment/offer/ad decisions, reward appeals and reversals, unused-voucher refunds, independent feature pauses, rule configuration and an audit trail. Account export includes the customer's wallet and memberships. Account deletion requires transferring/closing owned businesses and resolving valid unused vouchers first.

An approved appeal can restore a reversed reward once per decision state. Wallet support can release a spending restriction after the ledger has recovered to a non-negative balance; release never creates coins. Duplicate decisions cannot issue duplicate credits.

## Street View

Street View actions appear in map results, on the current map area and on real location details when coordinates are known. By default they open Google's supported panorama URL in a new tab; no Google project is needed. Unknown-coordinate and fictional place pages do not offer a panorama link. Coverage and capture dates are controlled by Google, and a nearby road may differ from the entrance.

To show a panorama inside DATED, enable the Maps Embed API in a billing-enabled Google Cloud project, restrict its browser key to the exact app origins and Maps Embed API, set `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` in `.env.local`, then restart/rebuild. The key is intentionally public browser configuration, so origin/API restrictions matter. External links remain available as a fallback. Live embedded imagery has not been verified without a configured project.

References: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started), [Street View embed](https://developers.google.com/maps/documentation/embed/embedding-map#streetview_mode), [Embed setup](https://developers.google.com/maps/documentation/embed/quickstart).

## Persistence, jobs and configuration

- Additive tables preserve existing reviews, users, outings and source catalog data. Back up the database and media together before hosting or importing data.
- `DATED_DATA_DIR` selects durable local storage. Use one persistent Node instance; this implementation is not an ephemeral/serverless store.
- `DATED_BUSINESS_PRICE_PHP` sets the pilot invoice price; wallet rule amounts/caps and feature pauses are changed through operator controls.
- The local commerce worker runs once a minute while the server is running. Set `DATED_COMMERCE_WORKER=false` only when another process runs maintenance. Pending jobs survive restarts, and unique ledger sources prevent duplicate awards.
- `node scripts/maintenance.mjs` also processes rewards, expiries, monthly snapshots and existing upload/session cleanup. The local computer must be running to perform work. Missed expiries are enforced in domain checks and caught up after restart.
- Coins use integer units; expenses/invoices use integer centavos. Claims/redemptions and invoice creation use transactions and actor-scoped retry keys. Public score eligibility and business permissions are server-owned.
- Private wallet, business, report and code responses use `Cache-Control: no-store`; the service worker caches only the offline shell. No customer code is returned in the operations list.

## Verification

```powershell
npm run typecheck
npm run lint
npm run test:catalog
npm run test:commerce
npm test
npm run build
```

Domain tests cover reward sentiment parity, duplicate awards, conflicts, voucher issue/retry/inventory, actual concurrent database connections competing for the final voucher, permissions, redemption, billing expiry/cancellation, sponsored eligibility, criterion compatibility, report samples, monthly snapshot uniqueness, group budgets and centavo conservation.

Browser/API journeys cover existing accounts/privacy/media/consent/planning flows plus customer review → coins → voucher → staff redemption, owner subscription/report/ads, branch authority, collaboration, revocable collection sharing, restored filters, mobile navigation and Street View links. New business reports and mobile wallet screens are checked with automated WCAG A/AA rules. Screenshots are saved in `docs/frontend/revised-platform/`. Automated checks do not replace manual assistive-technology or public-launch testing.

## External work still open

Final local checks passed: **20 browser/API tests**, **52 domain/catalog tests**, TypeScript, ESLint and the optimized Next.js build. The report and mobile wallet scans found no automated WCAG A/AA violations. Street View URL behavior was tested; live embedded Google imagery was not connected. The map screenshot from the isolated test environment captures the controls and results before remote basemap imagery is ready.

Visual review preserved the existing forest/sage and cream palette, DM Serif Display headings, DM Sans controls and venue imagery. New comparison, wallet, report, voucher, collaboration and planning surfaces use native React/CSS; no external component catalog or animation service was available or added. Motion is limited to short panel/ticket transitions and immediate control feedback, with reduced-motion alternatives. Internal visual review: 8/10 overall; this is a design assessment, not an external award or certification.

Supabase/PostgreSQL/RLS migration, hosted storage, verified email and recovery, online subscription checkout/webhooks, public hosting, production abuse monitoring, partner agreements and operational staffing require real projects and configuration. They were not provisioned or simulated. Native mobile apps and live route optimization are not part of this local web implementation. The original production acceptance gates remain open for these dependencies.
