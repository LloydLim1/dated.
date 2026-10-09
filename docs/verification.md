# Photo covers, Premium preview and review transparency — 10 October 2026

Location cards and place pages now use full-width photographs. Only verified business logos appear beside venue names; unverified venues have no initials or substitute symbols. Public journal photographs take precedence; fallback photographs are explicitly labeled illustrative. Private and followers-only posts never become directory covers. The H Proper card from the user's screenshot was checked at 1,440 and 390 pixels; the photograph fills the entire cover, and the card/detail views have no recorded automated WCAG A/AA violations, horizontal overflow or runtime errors. See [photo-cover results](frontend/photo-cover-verification.json).

Four Philippine operator sources added 260 verified logos to the local catalog: Max's Restaurant (59 branches), Pancake House (55), Yellow Cab Pizza Co. (41), and Chooks to Go (105). The marks were verified on the [Max's Group brand pages](https://www.maxsgroupinc.com/index.php/brand/maxs-restaurant-3/), [Pancake House page](https://www.maxsgroupinc.com/brand/pancake-house-2/), [Yellow Cab page](https://www.maxsgroupinc.com/brand/yellow-cab-4/), and [BAVI Academy's Chooks to Go listing](https://chooksacademy.chookstogo.com.ph/). Their verified logo caches are keyed to the exact mapped brand identity for reuse on the next weekly refresh. Food coverage is now 3,489 verified logos and 8,376 listings without logos; the 9 October OpenStreetMap snapshot, Philippine menus and published-price checks are unchanged.

Dated Premium is a free preview. Hosts can customize itinerary titles, introductions, stop order, times, durations, notes, optional planned budgets, two layouts and three palettes. Private designs persist; public links are explicit snapshots that can be updated or revoked. Private outing notes and companion details are excluded. Draft saves do not alter a shared copy; republishing after revocation produces a new token. Guests can open, print/save PDF and download timed stops without an account. Designer and shared-page print modes were checked, and exported calendar start/end times were verified in Philippine time. Localhost links need deployment to work on friends' devices.

Scores retain equal per-account weighting and now select the latest eligible visit date rather than submission date. Incentivized reviews remain readable but are excluded from scores and prominence. Private, hidden and sample reviews are excluded. Independent reviewer counts, supported-reviewer counts, an early-impressions notice below five reviewers, a method explanation and filters make the evidence visible. Repeat posts from one account and companions from one outing cannot inflate recent trending activity. Detail and bootstrap APIs return the same computed score. Support concerns moderator-assessed visit evidence; it does not make an opinion true or give it extra weight. Separate-account identity/abuse verification remains a public-launch dependency.

Validation: 28 catalog/source/hierarchy/credibility unit checks, fourteen existing browser journeys and three new itinerary/privacy/rating journeys pass. The new screens were scanned on desktop and mobile, including a guest shared itinerary. No recorded automated WCAG A/AA violations or horizontal overflow remain. An avatar contrast issue was corrected. Lint, strict type checking and the production build pass. Screenshots include [Premium designer](frontend/premium-designer-desktop.png), [shared mobile plan](frontend/premium-shared-mobile.png) and [review transparency](frontend/review-credibility-desktop.png).

The map keeps Dated's forest-green accents, parks and water; only the bright beige main roads were changed to light sage (`#c4d9b5`). Six desktop/tablet/mobile map states pass with the zoom hierarchy intact and no tile errors.

Nine additional source groups were checked: HenLin, Zagu, Master Siomai, MESA, Manam, Shawarma Shack, Banapple, Conti's and Kuya J. This adds 124 logo assignments and 82 confirmed menu links. Current food coverage is 11,865 mapped places across 17 validated city/municipality boundaries, 3,229 authentic cached logo assignments and 1,339 confirmed Philippine menus (1,285 reachable, 53 unavailable, one restricted). Explicit peso price data remains on 92 listings. All 174 used logo assets decode through their public routes, and nine additional mobile place pages pass accessibility/overflow checks. Sources without a customer menu remain websites only. Manam's ordering link is scoped to its exact brand and Kuya J's menu to Greater Manila. The 09:51 UTC OSM snapshot was enriched; this is not a new geographic scan. The 8,636 food listings without authentic logos remain incomplete, so the full-logo goal is not achieved. See [additional chain checks](frontend/additional-chain-verification.json) and [current coverage](frontend/logo-menu-coverage.json).

Earlier verification history follows.

# Expanded Philippine chain sources — 9 October 2026

Eight additional official sources now cover Hap Chan (27 listings), Tapa King (23), North Park (24), Angel's Pizza (22), Gerry's Grill (22), Serenitea (17), Turks (19) and 24 Chicken (17). Each group has verified logos and reachable Philippine menu links. Exact name/brand matching does not assign sources to similarly named equipment stores or cinema venues. Gerry's international website is scoped to its Philippine `/PH` menu; foreign regions and additional paths are excluded.

This update adds 169 logo assignments and 171 menu links. Current food coverage is 11,865 places across the same 17 validated city/municipality boundaries, 3,105 verified logo assignments and 1,257 confirmed Philippine menus (1,203 reachable, 53 unavailable, one restricted). Published price details appear on 92 listings, including 27 Hap Chan listings and 22 Gerry's listings added by this update. Their source-specific parsers read explicit peso amounts on named menu items; Gerry's parsing is restricted to its menu section. Cart totals, malformed amounts and foreign menu pages are excluded. Published ranges may include sharing and catering items and are not estimated spending per person.

Two authentic source PNG logos exceeded the former 16-million-pixel decoder limit. The bounded limit now admits originals up to 32 million pixels while downloads remain limited to four megabytes and output remains at most 160 by 160 pixels. Tests verify a 20-million-pixel original is resized and excessive decoded images are rejected. All eight source logos were visually reviewed.

Twenty-two catalog/source checks pass, alongside lint, strict type checking and the production build. Eight new chain mobile pages and eight existing catalog screens have no recorded automated WCAG A/AA violations, overflow or browser runtime errors. All 167 currently used logo files decode successfully through their public routes. The new pages preserve review and photo-post actions regardless of missing prices. Results are in [expanded chain checks](frontend/expanded-chain-verification.json) and [current coverage](frontend/logo-menu-coverage.json). The 8,760 food listings without verified logos remain incomplete; the goal is not achieved.

# Philippine chain enrichment — 9 October 2026

The latest enrichment used the complete 11,865-place Metro Manila snapshot from 09:51 UTC, with fresh website and menu checks. It adds 92 verified food-logo assignments and 79 Philippine menu links: total logo coverage is 2,936 food listings, confirmed menu sources 1,086, and published peso price details 43. Menu status is 1,032 reachable, 53 unavailable and one restricted. All 17 city/municipality counts are preserved; this enrichment does not claim a newer OSM geographic snapshot. ArmyNavy's old menu page returned 404; its current Philippine homepage links to a working Klikit ordering menu, whose ArmyNavy brand was confirmed in the browser. That exact menu is allowlisted, with unrelated provider accounts and alternate paths excluded; 36 listings now use it.

Exact official-name matches add Pickup Coffee and ArmyNavy sources even when OSM lacks a Wikidata brand identity. Longer unrelated names do not match. The logo extractor accepts authentic business images on Shopify/WordPress hosting, preserves apostrophes in quoted attributes and decodes apostrophe entities. Provider marks, comment avatars and default WordPress icons remain excluded. Visual review found and removed one newly imported provider mark. The 8,929 food listings without verified logos remain incomplete, with category symbols rather than invented images.

Pickup's official live menu was checked in the browser: items display PHP amounts. Its published RSC menu-item records provide a sourced ₱30–₱155 range on 42 matched listings; this is not estimated spending per person. The parser reads JSON without executing scripts and is scoped to the verified Philippine menu. Unrelated numbers, malformed data and Mexican market URLs are excluded. Sources and parsers are part of the regular weekly refresh. Nineteen catalog/source checks, strict type checking, lint and the production build pass. All 161 logo files currently used by real listings decode through their public routes; eight catalog screens and three new Philippine-chain mobile screens have no recorded accessibility violations, overflow or runtime errors. New screenshots and checks are in [chain screen results](frontend/philippine-chain-verification.json).

# Map hierarchy and cinema discovery — 9 October 2026

The Google Maps-inspired interface uses a continuous OpenFreeMap Positron base map, floating search, category chips, collapsible results, category-colored named symbols, verified business logos, location controls, compass and metric scale. Initials are removed from cards and place pages as well as map pins. Pin selection prioritizes actual Dated visits/reviews, then mapped landmark/brand metadata; logo availability is never a popularity signal. This is a local ranking, not Google's proprietary popularity data.

Sixteen catalog/source/hierarchy checks pass, covering density progression, visitor evidence, deterministic ordering, label collision and control exclusion, pending coordinates and cinema categories. All six discovery/photo/rating browser journeys pass again. ESLint, strict TypeScript checking and the production build pass.

Real production-map browser verification recorded 16 labels at zoom 11.2, 30 at 12.2, 36 at 14.2 and 28 at 16.2. Closer views expose new local venue identities; total labels can decrease as the viewport covers less ground. Tablet and mobile views were checked at 900 and 390 pixels. All six map screen states reported zero automated WCAG A/AA violations, horizontal overflow, tile failures or runtime errors. Collapse/reopen, cinema filtering/detail/review availability, and search/open of an address-only museum also pass. Screenshots and measurements are in [map hierarchy results](frontend/map-hierarchy-verification.json).

The cinema catalog contains 59 named OSM records, including separately mapped screens. No authentic cinema logos were confirmed in this import; film symbols remain visible. Cinema import leases and weekly due dates are separate from food and museums, and food scans do not mark cinema records missing. Full refresh includes all three directories. Backups include their audit files.

The catalog production review checks eight additional screens with no recorded accessibility violations, overflow or runtime errors. All 156 logo assets used by real listings successfully decode through their public routes. Current coverage remains 11,865 food places, 120 museums (99 mapped, 21 address-only) and 59 cinema records; 1,007 food menu sources are confirmed Philippine sources, with 954 reachable during the source scan. Ratings/photo journals remain available when menus, logos, prices or coordinates are missing. The local Monday automation is active; persistent-server due-refresh checks also remain enabled and can refresh saved menu/logo sources when the map scan is unavailable. Earlier schedule-status reports below are historical.

# Restaurant discovery and photo journal — 9 October 2026

- All twelve Playwright tests passed. The four new suites cover Overpass node/way imports and stable IDs, invalid search inputs, photo ownership and attachment reuse prevention, direct-image privacy, following/unfollowing, ordered galleries, likes/comments, editing/deletion/export, maintenance preservation, mobile posting, accessibility, upstream failures, and labeled fallback results.
- Strict TypeScript checking, ESLint, and the optimized production build passed. MapLibre 6's worker is explicitly bundled using its documented Next.js setup.
- Live OpenStreetMap discovery was verified around Makati: the final production check returned 739 named restaurants and cafés within 1.5 km. An earlier 100-place check included 15 mapped brand logos. Nearby markers are grouped for readability, filters update the markers, and cached searches survive server restarts.
- The production restaurant map returned zero Axe A/AA violations and zero browser JavaScript errors. See [restaurant map](frontend/restaurant-map-desktop.png).
- The new composer and mobile gallery returned zero Axe WCAG A/AA violations and no horizontal overflow. The screenshot [photo journal preview](frontend/photo-journal-mobile.png) uses a fictional test place and illustrative images in an isolated test store.
- Public Overpass is capped at 100 uncached pilot searches/day. Provider outages retain previously discovered nearby places with an explicit warning and retry action. A dedicated endpoint remains necessary for a public deployment.

# Frontend completion — 9 October 2026

- Eight Playwright suites passed, including collection creation while saving, renaming, editable plans, companion consent preservation, invitation previews and withdrawal, place deep links, browser history, unfinished form cancellation, and mobile Community navigation.
- Final production build and TypeScript checking passed. ESLint passed.
- Production UI review covered 27 screen states across desktop, laptop, tablet, and mobile sizes. Axe WCAG A/AA scans reported zero violations; no horizontal page overflow or browser JavaScript errors were observed. This is an automated review, not a comprehensive accessibility certification.
- Dialog screenshots wait for their entrance animation to complete. Review forms were also checked at their lower scroll position. Low-contrast place details, outing banners, upload controls, and rating labels were corrected.
- The review used a separate `.data-frontend-qa` store and removed its disposable accounts afterward. Existing pilot data was not used for screenshot fixtures.
- See [user journeys](user-journeys.md), [screen review results](frontend/verification.json), and screenshots in `frontend/`.

The product remains a local pilot with labeled fictional seed content alongside real OpenStreetMap discoveries. Infrastructure and public-launch dependencies listed below are still outstanding.

# Earlier verification — 8 October 2026

## Automated checks

- TypeScript strict checking: passed.
- ESLint (TypeScript + React hooks): passed.
- Next.js optimized production build: passed.
- Five Playwright suites: passed, covering accounts and ownership, collections, review visibility and duplication, following access, consent and withdrawal, private evidence, malformed uploads, account deletion, moderation assessment and audit, author appeals, browser discovery/saving, reviews, multi-stop outing journals, and mobile dialogs.
- `npm audit`: zero reported vulnerabilities in the final dependency set. MapLibre and Sharp were updated to patched versions; the vulnerable development-only glob dependency chain was removed.
- SQLite backup integrity: `ok`; all eight sample place records read from the restored snapshot.
- Maintenance: ran successfully against the pilot store.

## Browser and accessibility review

Chrome production preview reviewed at 1440×1000, 1280×720, 820×1180, and 390×844. No horizontal document overflow or browser JavaScript errors appeared. The laptop sidebar's secondary prompt hides on short screens; primary navigation remains reachable. The mobile surface uses a separate bottom navigation, photo-led scrolling place cards, and full-width browse results.

Axe WCAG A/AA checks returned zero violations at each reviewed size and in the filter dialog after contrast improvements. This is an automated result, not a claim of comprehensive accessibility certification. Native dialog focus trapping and Escape dismissal were exercised; reduced-motion mode was inspected. The app's map includes accessible marker labels and an attribution/city-list fallback.

The production preview's registration and cookie session were checked in Chrome with a temporary account; that account was deleted afterward. Denied geolocation and manual city fallback passed a separate browser check. Service-worker offline navigation displayed the safe static fallback and did not cache account content.

Screenshots: `desktop-final.png`, `laptop-final.png`, `tablet-final.png`, `mobile-final.png`, and `map-final.png`. Raw scan results: `accessibility-results.json`.

## Design review

Internal visual assessment: art direction 8.5, composition 8.3, typography 8.3, image/depth treatment 8.3, interaction/motion 7.8, component integration 8.0, polish 8.2. The quieter motion suits a discovery app; all important controls and content are available without animation. This is a subjective design review, separate from the automated checks.

## Practical limits

No public deployment, Supabase RLS test, PostGIS query/load test, email recovery check, licensed production-map test, media moderation/scanning service test, real-device iOS installation test, formal screen-reader audit, coordinated-abuse test, or production load/incident drill was performed. The app uses a persistent local store and fictional sample content. The remaining production implementation is listed in `production-plan.md` and the README.

## Metro Manila import and refresh verification — 9 October 2026

Later museum and Philippine-menu validation supersedes the food-only menu counts below: 120 real museums are imported, including 99 mapped and 21 address-only listings. The 88 Philippine Museums entries are represented by 79 identities after eight duplicate merges and one aggregate entry. All 87 individual source links are retained; the National Museum aggregate is represented by its separate museum buildings. Ten museum listings have verified logos. There are 1,007 confirmed Philippine menu sources on food listings, with 954 reachable and 53 unavailable in this scan. Global US menus and an unrelated redirected menu are suppressed. Menu-free ratings remain usable.

Twelve catalog/source checks pass, including museum sources, aliases and duplicate merging, address-only coordinates, closure notices, separate weekly due dates, incomplete-source protection, confirmed menu countries, foreign market paths and redirected menu rejection. All six discovery/photo/rating browser journeys pass, including museum criteria, posting a museum photo, and opening its gallery caption. Eight production desktop/mobile screens have zero recorded WCAG A/AA violations, overflow or runtime errors; all 156 currently used logo assets decode through their public routes. Museum admission and pin-pending screens were visually reviewed. The active Monday schedule now refreshes both directories.

The live Overpass snapshot contains 11,865 usable named food places across all 17 city/municipality boundaries. Logo checks cover all 125 identified brands, plus public business websites; 2,844 listings have verified cached image assets. The directory has 707 published menu links, including restricted sources, and one explicit machine-readable peso price range. The remaining 9,021 listings still need authenticated logos. Café Guide PH contributes 16 unique reference matches; its café photographs and external ratings were not imported.

Eight catalog checks cover complete geographic validation, weekly due dates, retaining records after incomplete scans, 125 identities processed in API-sized batches beyond the former 40-brand limit, local image decoding and cache reuse, exact/ambiguous brand matching, explicit peso pricing and change detection, private-source rejection, parked/unrelated website rejection, and unique Café Guide name/city matches. Missing map listings preserve memories, returning listings clear the unconfirmed flag, and large unexplained count drops are rejected. Website checks reject partner, publisher, award, and social marks; pale transparent wordmarks receive contrasting backing. A real mapped website now showing unrelated gambling content lost its logo and public website link.

The browser suite includes posting a public rating without a spending amount, distinguishing unknown spending from a known zero, rating totals, and unauthorized full-directory refresh rejection. The weekly local automation is active for Mondays at 4:00 AM Asia/Manila. Persistent servers additionally refresh due imports automatically; local scheduling does not imply execution while the computer is offline.

Final validation: eight catalog checks pass. All 13 browser journeys passed the earlier full run and corrected outing-selector rerun; the five discovery/photo/rating journeys passed again after these changes. Lint, strict type checking, and the optimized build pass. Production QA checked all 148 unique logo files used by Metro Manila listings through their public image routes and decoded them successfully; all were also reviewed visually. Bootstrap loaded in 1,188 ms in the latest local check. Desktop map, mobile menu, Café Guide-linked place, official menu, and a simulated unconfirmed-place screen have no recorded WCAG A/AA violations, horizontal overflow, or browser runtime errors. The actual unrelated website link is hidden. Results are in `docs/frontend/catalog-verification.json` with the `metro-*.png` screenshots.
# Dated map palette — 9 October 2026

The default OpenFreeMap vector style now uses Dated's existing CSS theme tokens: cream land, sage parks and buildings, muted green-blue water, soft gold main roads, and forest green place labels. Category symbols, result artwork, navigation controls and attribution surfaces follow the same palette; authentic business logos retain their original colors. Style sources, filters, road widths, zoom transitions, and attribution remain intact. An explicitly configured `NEXT_PUBLIC_MAP_STYLE_URL` retains that provider's own styling.

Validation: lint, strict TypeScript and the production build passed. The browser map check passed six city/neighborhood/street views across desktop, tablet and mobile, with no runtime errors, failed tiles, horizontal overflow or automated accessibility violations. Zoom-based pin hierarchy, cinema selection, panel collapse and address-only search also passed. Updated screenshots and results are in `docs/frontend/map-hierarchy-verification.json`.
