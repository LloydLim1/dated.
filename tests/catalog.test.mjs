import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import {
  CITIES,
  WEEK,
  initializeCatalog,
  catalogStatus,
  normalizePlace,
  brandIndex,
  boundaries,
  cityFor,
  importPlaces,
  reconcileMissingPlaces,
  enrichGuideReferences,
  syncMetro,
  enrichLogos,
  enrichMenus,
  enrichWebsiteLogos,
  publicLink,
  officialSource,
} from "../src/lib/place-catalog.mjs";
import {
  isPublicAddress,
  structuredMenuPrices,
  websiteLogo,
  websiteIdentityChanged,
} from "../src/lib/public-resource.mjs";

mkdirSync(resolve("tmp"), { recursive: true });
const directory = () => mkdtempSync(resolve("tmp", "catalog-test-"));
const database = () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE places(id TEXT PRIMARY KEY,data TEXT NOT NULL)");
  initializeCatalog(db);
  return db;
};
function snapshot() {
  const elements = [
    { type: "area", id: 3600147488, tags: { "ISO3166-2": "PH-00" } },
  ];
  Object.keys(CITIES).forEach((id, i) => {
    const lng = 121 + i / 100,
      lat = 14.5;
    elements.push({
      type: "relation",
      id: Number(id),
      tags: { admin_level: "6" },
      members: [
        {
          role: "outer",
          geometry: [
            [lng, lat],
            [lng + 0.005, lat],
            [lng + 0.005, lat + 0.005],
            [lng, lat + 0.005],
            [lng, lat],
          ].map(([lon, lat]) => ({ lon, lat })),
        },
      ],
    });
    elements.push({
      type: "node",
      id: i + 1,
      lat: lat + 0.002,
      lon: lng + 0.002,
      tags: { amenity: "restaurant", name: "Local restaurant " + i },
    });
  });
  return { elements };
}
test("full scan validates and assigns all 17 cities before importing, then respects weekly due dates", async () => {
  const db = database(),
    dir = directory(),
    source = snapshot();
  writeFileSync(resolve(dir, "nsi-source.json"), '{"nsi":{}}');
  const first = await syncMetro(db, dir, {
    source,
    now: 1000000000,
    fetcher: () => {
      throw new Error("Unexpected network request");
    },
  });
  assert.equal(first.count, 17);
  assert.equal(first.cities.length, 17);
  assert.ok(first.cities.every((c) => c.count === 1));
  assert.equal(first.added, 17);
  assert.equal(first.nextDue, 1000000000 + WEEK);
  const skipped = await syncMetro(db, dir, { now: 1000000001 });
  assert.equal(skipped.skipped, "not_due");
  const again = await syncMetro(db, dir, { source, now: 1000000000 + WEEK });
  assert.equal(again.added, 0);
  assert.equal(again.changed, 0);
  source.elements = source.elements.filter((e) => e.id !== 103703);
  await assert.rejects(
    syncMetro(db, dir, { source, force: true, now: 1000000000 + WEEK + 1 }),
    /Missing Manila boundary/,
  );
  assert.equal(db.prepare("SELECT count(*) n FROM places").get().n, 17);
  assert.equal(catalogStatus(db).lastSuccess, 1000000000 + WEEK);
  db.close();
});
test("logos resolve every identity beyond 40 and are validated, cached, and deduplicated locally", async () => {
  const db = database(),
    dir = directory(),
    places = Array.from({ length: 125 }, (_, i) => ({
      brandId: "Q" + (i + 1),
    }));
  const bytes = await sharp({
    create: { width: 4, height: 4, channels: 3, background: "#234a38" },
  })
    .webp()
    .toBuffer();
  let batches = 0,
    downloads = 0;
  const fetcher = async (url) => {
    if (String(url).startsWith("https://www.wikidata.org")) {
      batches++;
      const ids = new URL(url).searchParams.get("ids").split("|");
      assert.ok(ids.length <= 50);
      return {
        ok: true,
        json: async () => ({
          entities: Object.fromEntries(
            ids.map((id) => [
              id,
              {
                claims: {
                  P154: [
                    {
                      rank: "normal",
                      mainsnak: { datavalue: { value: id + ".webp" } },
                    },
                  ],
                },
              },
            ]),
          ),
        }),
      };
    }
    downloads++;
    return {
      ok: true,
      headers: new Map([["content-type", "image/webp"]]),
      arrayBuffer: async () => bytes,
    };
  };
  const result = await enrichLogos(db, dir, places, {
    fetcher,
    now: 1000000000,
  });
  assert.equal(batches, 3);
  assert.equal(downloads, 125);
  assert.equal(result.verifiedBrands, 125);
  assert.ok(places.every((p) => /^\/api\/logos\/[a-f0-9]{64}$/.test(p.logo)));
  const file = db.prepare("SELECT file FROM logo_files").get().file;
  assert.equal(
    (await sharp(readFileSync(resolve(dir, "logos", file))).metadata()).format,
    "webp",
  );
  await enrichLogos(db, dir, places, { fetcher, now: 1000000001 });
  assert.equal(downloads, 125);
  db.close();
});
test("identity matching is exact and ambiguity, unnamed and coordinate-less places remain excluded", () => {
  const entry = (q) => ({
    locationSet: { include: ["ph"] },
    tags: { brand: "Coffee Brand", "brand:wikidata": q },
  });
  const index = brandIndex({
    nsi: { "brands/amenity/cafe": { items: [entry("Q1"), entry("Q2")] } },
  });
  const raw = {
    type: "node",
    id: 1,
    lat: 14.5,
    lon: 121,
    tags: { amenity: "cafe", name: "Coffee Brand" },
  };
  assert.equal(normalizePlace(raw, { index }).brandId, undefined);
  assert.equal(normalizePlace({ ...raw, lat: undefined }), null);
  assert.equal(normalizePlace({ ...raw, tags: { amenity: "cafe" } }), null);
  assert.equal(normalizePlace(raw).budgetKnown, false);
  const cities = boundaries(snapshot().elements);
  assert.equal(cityFor(14.502, 121.002, cities), "Manila");
});
test("weekly menu checks update explicit peso prices, record changes, and permit unknown pricing", async () => {
  const db = database(),
    places = [
      normalizePlace({
        type: "node",
        id: 1,
        lat: 14.5,
        lon: 121,
        tags: {
          amenity: "restaurant",
          name: "Local",
          "website:menu": "https://menu.cafeoasis.ph/",
        },
      }),
    ];
  const reader = async () => ({
    status: 200,
    headers: { "content-type": "text/html" },
    bytes: Buffer.from(
      '<script type="application/ld+json">{"offers":{"priceCurrency":"PHP","price":"175"}}</script>',
    ),
  });
  await enrichMenus(db, places, { reader, now: 1000000000 });
  assert.equal(places[0].priceText, "Published items: ₱175");
  assert.equal(places[0].budgetKnown, false);
  assert.equal(places[0].menuStatus, "reachable");
  importPlaces(db, places, 1000000000, true);
  await enrichMenus(db, places, {
    reader: async () => ({ status: 403, headers: {}, bytes: Buffer.alloc(0) }),
    now: 1000000000 + WEEK + 1,
  });
  assert.equal(places[0].menuStatus, "restricted");
  const fresh = { ...places[0], priceText: undefined, priceSource: undefined };
  importPlaces(db, [fresh], 1000000000 + WEEK + 1, true);
  assert.ok(
    db
      .prepare("SELECT fields FROM place_changes")
      .all()
      .some((r) => JSON.parse(r.fields).includes("priceText")),
  );
  db.close();
});
test("public sources reject private addresses, unsafe links, photos pretending to be logos, and dollar prices", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.2",
    "192.168.0.10",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
  ])
    assert.equal(isPublicAddress(ip), false);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  for (const url of [
    "javascript:alert(1)",
    "http://127.0.0.1",
    "http://localhost",
    "https://user:password@restaurant.example",
  ])
    assert.equal(publicLink(url), undefined);
  assert.equal(
    structuredMenuPrices(
      '<script type="application/ld+json">{"priceRange":"$10-$20"}</script>',
    ),
    undefined,
  );
  assert.equal(
    websiteLogo(
      '<meta property="og:image" content="food.jpg">',
      "https://restaurant.example",
    ),
    undefined,
  );
  assert.equal(
    websiteLogo(
      '<title>HugeDomains</title><img alt="HugeDomains logo" src="/logo.svg">',
      "https://www.hugedomains.com",
      ["Chocolate Fire"],
    ),
    undefined,
  );
  assert.equal(
    websiteIdentityChanged(
      "<title>Togel Lotto | White Cafe</title>",
      "https://white.example",
    ),
    true,
  );
  assert.equal(
    websiteLogo(
      '<title>Togel Lotto | White Cafe</title><header><img alt="Logo KIMTOTO" src="/logo.svg"></header>',
      "https://white.example",
      ["White Cafe"],
    ),
    undefined,
  );
  assert.equal(
    websiteLogo(
      '<title>Car dealership</title><img alt="Logo" src="/logo.svg">',
      "https://restaurant.example",
      ["Coffee Place"],
    ),
    undefined,
  );
  assert.equal(
    websiteLogo(
      '<script type="application/ld+json">{"@type":"Restaurant","logo":"/brand.svg"}</script>',
      "https://restaurant.example",
    ),
    "https://restaurant.example/brand.svg",
  );
  assert.equal(
    websiteLogo(
      '<title>White Cafe</title><a href="/"><img class="site-logo" alt="" src="/brand.svg"></a>',
      "https://white.example",
      ["White Cafe"],
    ),
    "https://white.example/brand.svg",
  );
  assert.equal(
    websiteLogo(
      '<title>White Cafe</title><img src="/food-photo.jpg"><a href="/"><img src="/white-logo.svg"></a>',
      "https://white.example",
      ["White Cafe"],
    ),
    "https://white.example/white-logo.svg",
  );
  assert.equal(
    websiteLogo(
      '<title>White Cafe</title><header><img class="partner-logo" src="/grab-logo.svg"></header>',
      "https://white.example",
      ["White Cafe"],
    ),
    undefined,
  );
  assert.equal(
    websiteLogo(
      '<title>White Cafe</title><img src="/award-logo.svg"><footer><img src="/press-logo.png"></footer>',
      "https://white.example",
      ["White Cafe"],
    ),
    undefined,
  );
  assert.equal(
    websiteLogo(
      '<title>White Cafe</title><a href="/"><img src="/weblogo.png" alt="White Cafe"></a><img src="/michelin-logo.png">',
      "https://white.example",
      ["White Cafe"],
    ),
    "https://white.example/weblogo.png",
  );
  assert.equal(
    websiteLogo(
      '<title>White Cafe | Restaurant Group</title><a href="/"><img src="/group-logo.png" alt="Restaurant Group"></a>',
      "https://group.example/white-cafe/",
      ["White Cafe"],
    ),
    undefined,
  );
});

test("missing map listings retain history, recover on return, and incomplete scans never flag mass removals", async () => {
  const db = database(),
    dir = directory(),
    source = snapshot();
  writeFileSync(resolve(dir, "nsi-source.json"), '{"nsi":{}}');
  await syncMetro(db, dir, { source, now: 1000000000 });
  db.exec("CREATE TABLE memories(place_id TEXT, caption TEXT)");
  db.prepare("INSERT INTO memories VALUES(?,?)").run("osm-node-1", "My visit");
  const reduced = {
    elements: source.elements.filter((e) => !(e.type === "node" && e.id === 1)),
  };
  const next = await syncMetro(db, dir, {
    source: reduced,
    now: 1000000000 + WEEK,
  });
  assert.equal(next.newlyUnconfirmed, 1);
  assert.equal(next.unconfirmed, 1);
  const missing = JSON.parse(
    db.prepare("SELECT data FROM places WHERE id='osm-node-1'").get().data,
  );
  assert.equal(missing.mapStatus, "unconfirmed");
  assert.equal(missing.missingSince, 1000000000 + WEEK);
  assert.equal(db.prepare("SELECT count(*) n FROM memories").get().n, 1);
  assert.equal(
    reconcileMissingPlaces(
      db,
      reduced.elements.map((e) => ({ id: `osm-${e.type}-${e.id}` })),
    ).newlyUnconfirmed,
    0,
  );
  const returned = await syncMetro(db, dir, {
    source,
    now: 1000000000 + 2 * WEEK,
  });
  assert.equal(returned.unconfirmed, 0);
  assert.equal(returned.changed, 1);
  assert.equal(
    JSON.parse(
      db.prepare("SELECT data FROM places WHERE id='osm-node-1'").get().data,
    ).missingSince,
    undefined,
  );
  await assert.rejects(
    syncMetro(db, dir, {
      source: {
        elements: source.elements.filter((e) => e.type !== "node" || e.id < 3),
      },
      force: true,
      now: 1000000000 + 2 * WEEK + 1,
    }),
    /Unexpected drop/,
  );
  assert.equal(catalogStatus(db).lastSuccess, 1000000000 + 2 * WEEK);
  assert.equal(db.prepare("SELECT count(*) n FROM places").get().n, 17);
  assert.equal(
    JSON.parse(
      db.prepare("SELECT data FROM places WHERE id='osm-node-1'").get().data,
    ).mapStatus,
    "confirmed",
  );
  db.close();
});

test("official website logos remain legible when the source is a transparent white wordmark", async () => {
  const db = database(),
    dir = directory();
  const places = [{ name: "White Cafe", website: "https://white.example" }];
  const reader = async (url) => ({
    status: 200,
    url,
    headers: {
      "content-type": url.endsWith(".svg") ? "image/svg+xml" : "text/html",
    },
    bytes: Buffer.from(
      url.endsWith(".svg")
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect x="20" y="10" width="60" height="30" fill="white"/></svg>'
        : '<title>White Cafe</title><a href="/"><img class="site-logo" src="/brand.svg"></a>',
    ),
  });
  await enrichWebsiteLogos(db, dir, places, { reader, now: 1000000000 });
  assert.ok(places[0].logo);
  assert.equal(places[0].logoSource, "https://white.example");
  const file = db.prepare("SELECT file FROM logo_files").get().file;
  const { data } = await sharp(readFileSync(resolve(dir, "logos", file)))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 255);
  assert.ok(data[1] > data[0] && data[1] > data[2]);
  const fresh = [{ name: "White Cafe", website: "https://white.example" }];
  await enrichWebsiteLogos(db, dir, fresh, {
    reader: async (url) => ({
      status: 200,
      url,
      headers: { "content-type": "text/html" },
      bytes: Buffer.from(
        '<title>Togel Lotto | White Cafe</title><header><img alt="Logo KIMTOTO" src="/logo.svg"></header>',
      ),
    }),
    now: 1000000000 + WEEK + 1,
  });
  await enrichWebsiteLogos(db, dir, fresh, { now: 1000000000 + WEEK + 2 });
  assert.equal(fresh[0].logo, undefined);
  assert.equal(fresh[0].websiteStatus, "identity_unconfirmed");
  db.close();
});

test("guide matches require a unique name and city, and enrichment doesn't count unchanged records as updates", () => {
  const db = database();
  const places = [
    {
      id: "cafe-1",
      name: "Odd Cafe",
      city: "Makati",
      website: "https://cafe.example",
      logo: "/api/logos/verified",
      sample: false,
    },
    { id: "cafe-2", name: "Coffee Chain", city: "Makati" },
    { id: "cafe-3", name: "Coffee Chain", city: "Makati" },
  ];
  assert.equal(
    enrichGuideReferences(places, {
      checkedAt: "2026-10-09",
      entries: [
        ["Odd Cafe | Makati", "Makati City"],
        ["Coffee Chain", "Makati City"],
        ["Odd Cafe", "Taguig"],
      ],
    }),
    1,
  );
  assert.ok(places[0].guideUrl.includes("Odd%20Cafe"));
  assert.equal(places[1].guideUrl, undefined);
  importPlaces(db, places, 100, true);
  importPlaces(
    db,
    [{ ...places[0], website: undefined, logo: undefined }],
    101,
    false,
    true,
  );
  assert.equal(importPlaces(db, places, 102, true).changed, 0);
  db.close();
});

test("verified Philippine named sources match exact identities only and authentic Shopify-hosted logos remain eligible", () => {
  const base = { type: "node", id: 71, lat: 14.55, lon: 121.02 };
  const pickup = normalizePlace({
    ...base,
    tags: { amenity: "cafe", name: "Pickup Coffee" },
  });
  assert.equal(pickup.website, "https://www.pickup-coffee.com/");
  assert.equal(pickup.menuCountry, "PH");
  assert.equal(pickup.menuUrl, "https://www.pickup-coffee.com/menu");
  const unrelated = normalizePlace({
    ...base,
    tags: { amenity: "cafe", name: "Pickup Coffee Equipment Store" },
  });
  assert.equal(unrelated.website, undefined);
  const html = `<title>Bo&#39;s Coffee</title><header><a href="/"><img class="site-header__logo-image" alt="Bo's Coffee" src="https://cdn.shopify.com/s/files/1/bos-logo.png"></a><img alt="Shopify partner logo" src="https://cdn.shopify.com/partners/logo.svg"></header>`;
  assert.equal(
    websiteLogo(html, "https://www.boscoffee.com/", ["Bo's Coffee"]),
    "https://cdn.shopify.com/s/files/1/bos-logo.png",
  );
  assert.equal(
    websiteLogo(
      '<title>Bo\'s Coffee</title><header><img alt="Shopify partner logo" src="https://cdn.shopify.com/partners/logo.svg"></header>',
      "https://www.boscoffee.com/",
      ["Bo's Coffee"],
    ),
    undefined,
  );
});

test("provider marks and comment avatars are never imported as business logos", () => {
  const html =
    '<title>Sillon All Day Breakfast</title><a href="https://sillonph.wordpress.com/"><img class="avatar avatar-50" src="https://s-ssl.wordpress.com/i/logo/wpcom-gray-white.png"></a>';
  assert.equal(
    websiteLogo(html, "https://sillonph.wordpress.com/", [
      "Sillon All Day Breakfast",
    ]),
    undefined,
  );
  const structured =
    '<script type="application/ld+json">' +
    JSON.stringify({
      "@type": "Organization",
      name: "Sillon All Day Breakfast",
      logo: "https://s-ssl.wordpress.com/i/logo/wpcom-gray-white.png",
    }) +
    "</script>";
  assert.equal(
    websiteLogo(structured, "https://sillonph.wordpress.com/", [
      "Sillon All Day Breakfast",
    ]),
    undefined,
  );
});

test("Philippine chain sources resolve exact names without confusing neighboring brands or cinema venues", () => {
  const checks = [
    ["Hap Chan", "hapchan.com.ph"],
    ["Tapa King", "tapaking.com.ph"],
    ["North Park", "northpark.com.ph"],
    ["Angel's Pizza", "angelspizza.com.ph"],
    ["Gerry's Grill", "gerrysgrill.com"],
    ["Serenitea", "iloveserenitea.com"],
    ["Turks", "turks.ph"],
    ["24 Chicken", "24chicken.com"],
    ["Hen Lin", "henlin.com"],
    ["Zagu", "zagushakes.com"],
    ["Master Siomai", "mastersiomai.com"],
    ["MESA", "mesarestaurant.ph"],
    ["Manam", "momentgroup.ph"],
    ["Shawarma Shack", "shawarmashack.ph"],
    ["Banapple", "banapple.ph"],
    ["Conti's", "contis.ph"],
    ["Kuya J", "kuyaj.ph"],
  ];
  for (const [name, host] of checks) {
    const source = officialSource({ name, category: "Restaurant" });
    assert.equal(new URL(source.website).hostname.replace(/^www\./, ""), host);
    assert.equal(
      officialSource({ name: name + " Equipment", category: "Restaurant" }),
      undefined,
    );
    assert.equal(officialSource({ name, category: "Cinema" }), undefined);
  }
  assert.notEqual(
    officialSource({ name: "Angel's Pizza", category: "Restaurant" }).website,
    officialSource({
      brandId: "Q62267228",
      name: "Angel's Burger",
      category: "Restaurant",
    }).website,
  );
});

test("Philippine operator pages are selected for missing logos without exposing them as menu links", () => {
  const checks = [
    ["Q62267166", "Andok's", "andoks.com.ph"],
    ["Q17065023", "Chooks to Go", "chooksacademy.chookstogo.com.ph"],
    ["Q6794477", "Max's Restaurant", "www.maxsgroupinc.com"],
    ["Q138635080", "Pancake House", "www.maxsgroupinc.com"],
    ["Q8051689", "Yellow Cab Pizza Co.", "www.maxsgroupinc.com"],
  ];
  for (const [brandId, name, host] of checks) {
    const source = officialSource({ brandId, name, category: "Restaurant" });
    assert.equal(source.name, name);
    assert.equal(new URL(source.logoWebsite).hostname, host);
    assert.equal(source.menu, undefined);
    assert.equal(
      officialSource({ brandId, name, category: "Museum" }),
      undefined,
    );
  }
});

test("verified official logo caches repopulate every exact-brand branch on later refreshes", async () => {
  const db = database(),
    dir = directory(),
    source = officialSource({
      brandId: "Q6794477",
      name: "Max's Restaurant",
      category: "Restaurant",
    }).logoWebsite,
    file = "verified-brand.webp",
    bytes = await sharp({
      create: { width: 32, height: 32, channels: 4, background: "#a52020" },
    })
      .webp()
      .toBuffer(),
    now = Date.now();
  mkdirSync(resolve(dir, "logos"), { recursive: true });
  writeFileSync(resolve(dir, "logos", file), bytes);
  db.prepare("INSERT INTO website_assets VALUES(?,?)").run(
    source,
    JSON.stringify({
      checkedAt: now,
      status: "verified",
      identityValidated: true,
      extractorVersion: 8,
      logo: "/api/logos/verified-brand",
      logoSource: source,
      file,
      imageVersion: 2,
    }),
  );
  const branches = [
    { brandId: "Q6794477", name: "Max's Restaurant", category: "Restaurant" },
    { brandId: "Q6794477", name: "Max's Restaurant", category: "Restaurant" },
    { brandId: "Q8051689", name: "Yellow Cab Pizza", category: "Restaurant" },
  ];
  let reads = 0;
  await enrichWebsiteLogos(db, dir, branches, {
    now,
    reader: async () => {
      reads++;
      throw new Error("The fresh official logo cache should avoid a read.");
    },
  });
  assert.equal(branches[0].logo, "/api/logos/verified-brand");
  assert.equal(branches[1].logo, "/api/logos/verified-brand");
  assert.equal(branches[0].logoSource, source);
  assert.equal(branches[2].logo, undefined);
  assert.equal(reads, 1);
});

test("lazy-loaded branded wordmarks are recognized without selecting lazy food pictures or provider marks", () => {
  const html = '<title>Kuya J Restaurant</title><img src="data:image/gif;base64,R0lGODlh" data-src="//kuyaj.ph/assets/kuyajlogoupdated.png" title="kuyajlogoupdated"><img data-src="/assets/kuyaj-food.png">';
  assert.equal(websiteLogo(html, "https://kuyaj.ph/", ["Kuya J"]), "https://kuyaj.ph/assets/kuyajlogoupdated.png");
  assert.equal(websiteLogo('<title>Kuya J</title><img data-src="/assets/kuyaj-food.png">', "https://kuyaj.ph/", ["Kuya J"]), undefined);
  assert.equal(websiteLogo('<title>Kuya J</title><img alt="Shopify logo" data-src="/shopify-logo.png">', "https://kuyaj.ph/", ["Kuya J"]), undefined);
  assert.equal(websiteLogo('<title>Kuya J</title><img alt="Kuya J" data-src="https://[broken">', "https://kuyaj.ph/", ["Kuya J"]), undefined);
});

test("large authentic logo originals are resized and excessive decoded images are rejected", async () => {
  const db = database(),
    dir = directory();
  const image = await sharp({
    create: { width: 5000, height: 4000, channels: 4, background: "#267548" },
  })
    .png()
    .toBuffer();
  const place = { name: "Large Cafe", website: "https://large.example/" };
  const reader = async (url) => ({
    url,
    status: 200,
    headers: {
      "content-type": url.endsWith(".png") ? "image/png" : "text/html",
    },
    bytes: url.endsWith(".png")
      ? image
      : Buffer.from(
          '<title>Large Cafe</title><header><img alt="Large Cafe logo" src="/logo.png"></header>',
        ),
  });
  await enrichWebsiteLogos(db, dir, [place], { reader, now: 123456789 });
  assert.ok(place.logo);
  const file = db.prepare("SELECT file FROM logo_files").get().file;
  const meta = await sharp(
    readFileSync(resolve(dir, "logos", file)),
  ).metadata();
  assert.ok(meta.width <= 160 && meta.height <= 160);
  const excessive = {
    name: "Excessive Cafe",
    website: "https://excessive.example/",
  };
  await enrichWebsiteLogos(db, dir, [excessive], {
    now: 123456790,
    reader: async (url) => ({
      url,
      status: 200,
      headers: {
        "content-type": url.endsWith(".svg") ? "image/svg+xml" : "text/html",
      },
      bytes: Buffer.from(
        url.endsWith(".svg")
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="50000" height="50000"><rect width="50000" height="50000" fill="red"/></svg>'
          : '<title>Excessive Cafe</title><header><img alt="Excessive Cafe logo" src="/logo.svg"></header>',
      ),
    }),
  });
  assert.equal(excessive.logo, undefined);
  db.close();
});
