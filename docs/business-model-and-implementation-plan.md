# Dated business model and implementation plan

## Product direction

Dated is a mobile-first local discovery and memory app for customers, with a public web landing page and a paid business workspace. Customers use the core app for free. Their independent reviews and public discovery activity help participating places understand how visits are going. Businesses pay Dated for verified business tools, performance reporting and relevant sponsored reach; they fund the vouchers customers can redeem with earned coins.

The exchange should be easy to explain:

1. A customer discovers and visits a place.
2. They can save a private photo journal, publish a review, or do both.
3. An eligible review can earn coins regardless of its rating or sentiment.
4. The customer chooses a partner-funded voucher from participating businesses.
5. Verified businesses pay for workspace tools and aggregated performance insight.

Customers provide value through voluntary feedback and discovery behavior. That does not make their private journal, identity or personal activity a business asset. Dated should sell business tools and carefully limited aggregate insight, not customer-level data.

## Concept assessment and trust rules

The model has a clear two-sided value exchange: useful feedback and local discovery for businesses, useful discovery and rewards for customers. It can create a repeat loop when the business improves a visit and a voucher gives the customer a reason to return. The main product risk is allowing rewards or business payments to weaken review credibility.

Keep these rules as product invariants:

- Reward eligibility may depend on review completeness, duplicate detection and moderation, but never on a positive rating, favorable language or a business request.
- Label incentivized reviews. Keep them out of business quality reports and public venue ratings, as the pilot currently does.
- Keep private and follower-only journals, private photos, private outing data, account identity and location history out of business reports and advertising audiences.
- Do not let businesses identify which customer wrote a reportable review from Dated analytics. Use minimum cohort thresholds, suppress small groups, and present trends and counts rather than individual activity.
- Separate independent quality signals from paid promotion. Sponsored placements must be labeled and reported separately.
- Make voucher cost, stock, validity, minimum spend, funding party and redemption rules visible before a customer claims an offer. Do not present an unapproved or unfunded offer as available.
- Verify a business’s authority over each branch before reports, offers, advertising or staff access are enabled.

There is one pilot boundary to review before a public business launch: current reports are based on public, non-incentivized reviews and aggregated events, but their payload also includes a limited set of public review titles/body excerpts and review IDs. Private journals are not used. Decide whether verified public excerpts are an explicit part of the business product or whether the production report should use only thresholded summaries and aggregates; document that choice in customer-facing privacy and business terms.

## What already exists in the local pilot

The codebase already contains substantial journeys, so the production plan should build on them rather than recreate them:

- **Customer app:** mobile navigation, local place search and map, saves, photo journals, structured reviews, outing planning and sharing, coins, voucher discovery and redemption.
- **Customer trust:** eligibility-based review rewards, reward appeals, review moderation, public rating evidence rules, and separation of incentivized reviews from ratings and business reports.
- **Business workspace:** organization setup, branch claims and verification workflow, owner/manager/analyst/staff roles, location details, performance reports and exports, manual invoices, period-end cancellation, offers, campaigns, and staff voucher redemption.
- **Admin/operations:** moderator and operator queues, manual invoice verification, business claim review, reward appeals, reports, campaign review, and audit history.
- **Web routes:** `/business` enters the business workspace; `/operations` is role-gated for administrators. Both use the existing account system.

These are functioning local-pilot journeys backed by the current SQLite/filesystem store. They are not yet a hosted subscription service or production-scale analytics platform.

## Interfaces and user journeys

The application remains mobile-first. The website provides a responsive landing page at `/`, then routes customers and businesses into the existing app:

| Audience | Landing-page action | Product destination | Main journey |
| --- | --- | --- | --- |
| New customer | Join free | `/explore?auth=signup` | Sign up → discover → save or visit → publish a review or photo journal → earn eligible coins → claim a partner voucher |
| Returning customer | Sign in | `/explore?auth=login` | Sign in → return to discovery, journal, outings or wallet |
| Business owner | Business tools | `/business` | Sign in/create account → create workspace → claim and verify branch → review plan → request subscription → use reports, offers and campaign tools |
| Business teammate | Business sign in | `/business?auth=login` | Sign in → open only assigned organization/branch capabilities |
| Operator/admin | Staff access | `/operations?auth=login` | Sign in → role check → review claims, billing, rewards, campaigns or moderation queues |

The landing page should explain the value exchange, free customer access, paid business workspace, how the customer journey works, and the review/reward trust rules. The interactive preview shows the discover → journal → reward loop without pretending that illustrative locations or metrics are live data. Admin tools remain available through the protected operations route; they are not a public product pitch or a role users can select during signup.

## Implementation phases

### 1. Public entry and role handoff

**Included in this change:** replace the root app screen with the public landing page; add clear B2C and B2B calls to action; route customers into the existing mobile-first app; open the existing auth dialog in the requested sign-in or sign-up mode; keep `/app` as the installable app’s For You route; preserve `/business` and `/operations`; make installed PWA launches open `/app`.

**Acceptance:** a guest can understand the free/paid split, choose the correct destination, open sign-up or sign-in directly, and continue to the intended customer or business journey. The existing business and admin authorization checks remain authoritative.

### 2. Trustworthy business insight

Before growing the analytics product, define the report contract and privacy policy in code:

- Separate published independent reviews, incentivized reviews, private journals and aggregate event counts in the data model and report logic.
- Confirm which published review excerpts a business may see; remove identifiers or direct text if the chosen product is aggregate-only.
- Add minimum report cohort thresholds, small-cell suppression, clear sample-size labels, period comparisons and uncertainty/low-volume states.
- Add report provenance: included sources, excluded incentivized activity, time period, sample size and last refresh.
- Keep analytics limited to a business’s verified branches and authorized team role; audit report exports and role changes.
- Add report deletion/retention rules and a user-facing explanation of what is public, private and aggregated.

**Acceptance:** test with small samples, repeat reviewers, hidden reviews, private journals, incentivized reviews, unrelated branches and unauthorized staff. No private content or customer identity appears in a business report; low-volume reports suppress sensitive detail.

### 3. Real subscriptions and voucher settlement

Replace manual payment references with a production billing provider and verified server-side webhooks. Separate the recurring Dated workspace subscription from optional campaign spend and partner-funded voucher liabilities. Define plan entitlements, invoice/tax records, failed-payment handling, cancellation, refunds, operator adjustments and reconciliation before enabling paid access.

For vouchers, define who funds the discount, how stock is reserved, how redemption is validated, what happens when the offer expires or a branch closes, and how Dated and the business reconcile redemptions. Keep the existing atomic claim and single-use redemption behavior when moving storage.

**Acceptance:** entitlement changes only after verified payment events; idempotent webhooks cannot double-charge or activate twice; voucher claims and redemptions reconcile with the partner ledger; canceled, expired or disputed offers have a safe customer recovery path.

### 4. Production identity, storage and operations

Migrate the local store to the planned hosted database/auth/storage architecture in `docs/production-plan.md`. Add verified email and recovery, server-enforced authorization, protected media delivery, image scanning, rate limits, abuse monitoring, moderation staffing, customer support and operational alerts. Preserve stable place IDs, reviews, posts, photos, collections and reward ledgers throughout migration.

**Acceptance:** run authorization, privacy, recovery, restore, load and mobile-network checks against staging using separate customer, owner, analyst, staff and admin accounts. No production launch until backups, monitoring, reporting and incident response are exercised.

### 5. Pilot economics and launch gates

Pilot in a limited set of verified Metro Manila branches. Test the entire value loop with real participating businesses: customer activation, review quality, reward cost, voucher claim/redemption, business report use, subscription renewal and churn. Interview customers and owners, and adjust plan price and reward economics from observed behavior rather than seeded examples.

Track aggregate product outcomes such as discovery-to-place opens, completed independent reviews, repeat customer visits where explicitly consented, voucher claim/redemption, business report adoption, and subscription renewal. Do not optimize review valence, pressure customers to post, or share individual customer journeys with businesses.

## Production blockers and decision gates

The current implementation uses local SQLite and filesystem media; it is not suitable for an ephemeral serverless deployment. Online subscription payments are not connected, and the local pilot requires an administrator to verify a real manual payment reference. Email verification/recovery, hosted database and media storage, public deployment, production abuse controls, and operating/support processes are still outstanding. Localhost share links do not provide cross-device sharing.

Before public B2B sales, settle three decisions: the public-review excerpt policy described above; the subscription tiers and included branches/report cadence; and the accounting/settlement rules for merchant-funded vouchers and campaign spend. Keep those decisions separate from the public landing-page claims until the related backend integrations are real.
