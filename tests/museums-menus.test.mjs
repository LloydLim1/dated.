import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { resolve } from "node:path";
import { philippineMenu } from "../src/lib/philippine-menus.mjs";
import { publishedMenuPrices } from "../src/lib/public-resource.mjs";
import {
  parseMuseumDetail,
  buildMuseumPlaces,
  syncMuseums,
} from "../src/lib/museum-catalog.mjs";
import {
  normalizePlace,
  enrichMenus,
  initializeCatalog,
  importPlaces,
  WEEK,
  CITIES,
} from "../src/lib/place-catalog.mjs";

const cities = [
  {
    name: "Manila",
    box: [120, 14, 122, 15],
    outer: [
      [
        [120, 14],
        [122, 14],
        [122, 15],
        [120, 15],
        [120, 14],
      ],
    ],
    inner: [],
  },
];
const museum = {
  type: "node",
  id: 41,
  lat: 14.5,
  lon: 121,
  tags: { name: "UST Museum", tourism: "museum" },
};
const db = () => {
  const d = new DatabaseSync(":memory:");
  d.exec("CREATE TABLE places(id TEXT PRIMARY KEY,data TEXT NOT NULL)");
  initializeCatalog(d);
  return d;
};

test("only confirmed Philippine operator menus are accepted, including redirect destinations", async () => {
  assert.ok(philippineMenu("https://www.jollibee.com.ph/menu/"));
  assert.ok(philippineMenu("https://potatocorner.com/menu/"));
  for (const value of [
    "https://www.bonchon.com/menu",
    "https://www.shakeys.com/menu",
    "https://starbucks.com/menu",
    "https://mixuemenu.com",
    "https://www.starbucks.ph/menu?market=US",
    "https://www.starbucks.ph/menu/usa",
    "https://www.starbucks.ph.evil.example/menu",
    "https://facebook.com/unknown/menu",
  ])
    assert.equal(philippineMenu(value), undefined);
  const d = db(),
    p = normalizePlace({
      type: "node",
      id: 1,
      lat: 14.5,
      lon: 121,
      tags: {
        name: "Bonchon",
        amenity: "restaurant",
        "brand:wikidata": "Q4941248",
      },
    });
  assert.equal(p.menuUrl, "https://bonchon.com.ph/menu");
  await enrichMenus(d, [p], {
    reader: async () => ({
      status: 200,
      url: "https://www.bonchon.com/menu",
      headers: { "content-type": "text/html" },
      bytes: Buffer.from("US menu $10"),
    }),
    now: 100000,
  });
  assert.equal(p.menuUrl, undefined);
  assert.equal(p.menuCountry, undefined);
  assert.equal(p.menuUnavailableReason, "country_unconfirmed");
  assert.equal(p.priceText, undefined);
  assert.equal(p.budgetKnown, false);
  importPlaces(d, [p]);
  assert.equal(
    JSON.parse(d.prepare("SELECT data FROM places").get().data).id,
    p.id,
  );
  d.close();
});

test("new Philippine operator menus stay within the verified brand and country", () => {
  for (const url of [
    "https://zagushakes.com/menu/",
    "https://manam.momentfood.com/",
    "https://shawarmashack.ph/our-menu.html",
    "https://banapple.ph/shop/",
    "https://www.contis.ph/pages/restaurant-menu",
    "https://kuyaj.ph/menu-gma/",
  ]) assert.equal(philippineMenu(url), url);
  for (const url of [
    "https://www.manam.sg/menu",
    "https://another-brand.momentfood.com/",
    "https://manam.momentfood.com/?country=sg",
    "https://www.contis.net/menu",
    "https://www.contis.ph/pages/restaurant-menu/us",
    "https://shawarmashack.ph/our-menu.html?market=us",
  ]) assert.equal(philippineMenu(url), undefined);
});

test("museum details retain factual sources and closure notices without copying descriptive content", () => {
  const html =
    '<h1>Test Museum</h1><div class="museum-field"><strong>Address</strong><span>Manila</span></div><div class="museum-field"><strong>Admission</strong><span>₱50 (Temporarily Closed)</span></div><iframe src="https://www.openstreetmap.org/export/embed.html?marker=14.5%2C121"></iframe><p>Directory copyrighted description</p>';
  const r = parseMuseumDetail(
    html,
    "https://philippinemuseums.com/museums/test-museum/",
    123,
  );
  assert.equal(r.lat, 14.5);
  assert.equal(r.lng, 121);
  assert.equal(r.address, "Manila");
  assert.match(r.visitingNotice, /temporarily closed/);
  assert.equal(r.description, undefined);
  assert.throws(() =>
    parseMuseumDetail(html, "https://foreign.example/museums/test/", 123),
  );
});

test("museum directory matches mapped aliases, merges duplicate entries, and retains unmapped gaps", () => {
  const records = [
    {
      id: 1,
      name: "UST Museum of Arts & Sciences",
      url: "https://philippinemuseums.com/museums/ust-a/",
      admissionText: "₱100",
    },
    {
      id: 2,
      name: "UST Museum of Arts and Sciences",
      url: "https://philippinemuseums.com/museums/ust-b/",
    },
    {
      id: 3,
      name: "Museum with no location",
      url: "https://philippinemuseums.com/museums/unknown/",
    },
  ];
  const r = buildMuseumPlaces(records, { elements: [museum] }, cities);
  assert.equal(r.places.length, 1);
  assert.equal(r.duplicates, 1);
  assert.equal(r.unlocated.length, 1);
  assert.equal(r.places[0].category, "Museum");
  assert.equal(r.places[0].city, "Manila");
  assert.equal(r.places[0].admissionText, "₱100");
  assert.equal(r.places[0].budgetKnown, false);
  assert.equal(r.places[0].menuUrl, undefined);
  const d = db();
  importPlaces(d, r.places);
  d.close();
  const addressOnly = buildMuseumPlaces(
    [
      {
        id: 4,
        name: "Address Museum",
        address: "Taft Avenue, Manila",
        url: "https://philippinemuseums.com/museums/address/",
      },
    ],
    { elements: [] },
    cities,
  );
  assert.equal(addressOnly.places[0].locationStatus, "address_only");
  assert.equal(addressOnly.places[0].lat, null);
  assert.equal(addressOnly.places[0].lng, null);
});

test("museum refresh leases, weekly schedule and incomplete source protection preserve existing museums", async () => {
  const d = db(),
    dir = mkdtempSync(resolve("tmp", "museum-test-"));
  const options = {
    source: {
      records: [
        {
          id: 1,
          name: "UST Museum",
          url: "https://philippinemuseums.com/museums/ust/",
        },
      ],
    },
    osmSource: { elements: [museum] },
    boundarySource: { elements: [] },
    now: 100000,
  };
  // Missing all 17 city boundaries cannot silently replace a full catalog.
  await assert.rejects(syncMuseums(d, dir, options));
  assert.equal(d.prepare("SELECT COUNT(*) n FROM places").get().n, 0);
  const full = {
    elements: Object.keys(CITIES).map((id) => ({
      type: "relation",
      id: Number(id),
      tags: { admin_level: "6" },
      members: [
        {
          role: "outer",
          geometry: cities[0].outer[0].map(([lon, lat]) => ({ lon, lat })),
        },
      ],
    })),
  };
  const ready = await syncMuseums(d, dir, {
    ...options,
    boundarySource: full,
    force: true,
  });
  assert.equal(ready.count, 1);
  assert.equal(ready.nextDue, options.now + WEEK);
  assert.equal(
    (
      await syncMuseums(d, dir, {
        ...options,
        boundarySource: full,
        now: options.now + 1,
      })
    ).skipped,
    true,
  );
  await assert.rejects(
    syncMuseums(d, dir, {
      ...options,
      boundarySource: full,
      source: { records: [] },
      force: true,
      now: options.now + WEEK,
    }),
  );
  assert.equal(d.prepare("SELECT COUNT(*) n FROM places").get().n, 1);
  d.close();
});

test("Pickup Philippine menu reads published item prices and rejects unrelated numbers or markets", () => {
  const payload =
    "19:" +
    JSON.stringify([
      "$",
      "$Lmenu",
      null,
      {
        menuItems: {
          COFFEE: [
            { name: "Espresso", type: "drink", price: 50 },
            { name: "Latte", type: "drink", price: 95 },
            { name: "Invalid", type: "drink", price: "free" },
          ],
        },
        visitorCount: 50000,
      },
    ]) +
    "\n";
  const html =
    "<script>self.__next_f.push(" + JSON.stringify([1, payload]) + ")</script>";
  assert.equal(
    publishedMenuPrices(html, "https://www.pickup-coffee.com/menu"),
    "Published items: ₱50–₱95",
  );
  assert.equal(
    publishedMenuPrices(html, "https://other.example/menu"),
    undefined,
  );
  assert.equal(
    publishedMenuPrices(html, "https://www.pickup-coffee.com/menu?country=mx"),
    undefined,
  );
  assert.equal(
    philippineMenu("https://www.pickup-coffee.com/menu/mx"),
    undefined,
  );
  assert.ok(
    philippineMenu("https://menu.klikit.io/menu/RgjhghP61njsX01UKZELO4L9"),
  );
  assert.equal(
    philippineMenu("https://menu.klikit.io/menu/another-business"),
    undefined,
  );
  assert.equal(
    philippineMenu(
      "https://menu.klikit.io/menu/RgjhghP61njsX01UKZELO4L9?redirect=foreign",
    ),
    undefined,
  );
  assert.equal(
    philippineMenu(
      "https://menu.klikit.io/menu/RgjhghP61njsX01UKZELO4L9/foreign",
    ),
    undefined,
  );
  assert.equal(
    publishedMenuPrices(
      '<script>self.__next_f.push([1,"bad"])</script>',
      "https://www.pickup-coffee.com/menu",
    ),
    undefined,
  );
});

test("Philippine menu adapters read named peso items and exclude foreign pages, cart totals and malformed prices", () => {
  const hap =
    "<h3>Patatim <b><span>₱1,288.00</h3></b><h3>Chicken <span>₱298.00</h3><div>Cart total ₱9,999</div><h3>Dollar special $3</h3>";
  assert.equal(
    publishedMenuPrices(
      hap,
      "https://www.hapchan.com.ph/menu-chineseclassic.html",
    ),
    "Published items: ₱298–₱1288",
  );
  const gerry =
    '<section id="menu"><li><span>Rice</span><span>&#x20B1;28</span></li><li>Party platter <span>&#8369;3,835</span></li><li>Not a price 20 people</li></section><li>Cart total ₱9999</li>';
  assert.equal(
    publishedMenuPrices(gerry, "https://www.gerrysgrill.com/PH#menu"),
    "Published items: ₱28–₱3835",
  );
  assert.equal(
    publishedMenuPrices(gerry, "https://www.gerrysgrill.com/usa"),
    undefined,
  );
  assert.equal(philippineMenu("https://www.gerrysgrill.com/usa"), undefined);
  assert.equal(
    philippineMenu("https://www.gerrysgrill.com/PH/QATAR"),
    undefined,
  );
  assert.ok(philippineMenu("https://www.gerrysgrill.com/PH#menu"));
  assert.equal(
    publishedMenuPrices(
      "<h3>₱0.00</h3><h3>Fake ₱30,000,00</h3>",
      "https://www.hapchan.com.ph/menu-chineseclassic.html",
    ),
    undefined,
  );
  assert.equal(
    publishedMenuPrices(
      "<div>Shopping cart &#8369;0.00</div>",
      "https://iloveserenitea.com/menu/",
    ),
    undefined,
  );
});
