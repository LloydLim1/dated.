import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import {
  publicResource,
  publishedMenuPrices,
  websiteLogo,
  websiteIdentityChanged,
} from "./public-resource.mjs";
import guide from "./cafe-guide-references.json" with { type: "json" };
import official from "./official-brand-sources.json" with { type: "json" };
import { philippineMenu, philippineWebsite } from "./philippine-menus.mjs";

export const WEEK = 7 * 86400000;
const DAY = 86400000;
const METRO_MANILA_RELATION_ID = 147488;
const AREA_RELATION_OFFSET = 3600000000;
export const CITIES = {
  103703: "Manila",
  103716: "Makati",
  106569: "Quezon City",
  113858: "Pasay",
  122940: "Parañaque",
  131653: "Pateros",
  131703: "Pasig",
  146949: "Marikina",
  184776: "Taguig",
  273242: "Caloocan",
  307470: "Valenzuela",
  379812: "Navotas",
  403176: "Malabon",
  1346849: "Muntinlupa",
  2095594: "Las Piñas",
  2284209: "Mandaluyong",
  2284210: "San Juan",
};
const identityKey = (s) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function officialSource(place) {
  if (place.category && !["Restaurant", "Café"].includes(place.category))
    return undefined;
  if (official.brands[place.brandId]) return official.brands[place.brandId];
  const names = [place.brandName, place.name].filter(Boolean).map(identityKey);
  const matched = (official.namedBrands || []).filter((source) =>
    source.aliases.some((alias) => names.includes(identityKey(alias))),
  );
  return matched.length === 1 ? matched[0] : undefined;
}

async function logoBytes(source, contrastOnly = false) {
  const image = sharp(source, { limitInputPixels: 32000000 }).resize(160, 160, {
    fit: "inside",
    withoutEnlargement: true,
  });
  const { data, info } = await image
    .clone()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let visible = 0,
    light = 0,
    transparent = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 32) transparent++;
    if (data[i + 3] < 64) continue;
    visible++;
    if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] > 190)
      light++;
  }
  // White wordmarks need a contrasting backing to remain legible on the cream interface.
  if (
    visible &&
    light / visible > 0.8 &&
    transparent / (info.width * info.height) > 0.1
  )
    image.flatten({ background: "#183c30" });
  else if (contrastOnly) return source;
  return image.webp().toBuffer();
}

async function ensureLogoContrast(db, dataDir, asset) {
  if (
    !asset?.logo ||
    asset.imageVersion === 2 ||
    !asset.file ||
    !existsSync(resolve(dataDir, "logos", asset.file))
  )
    return asset;
  const bytes = await logoBytes(
    readFileSync(resolve(dataDir, "logos", asset.file)),
    true,
  );
  const hash = createHash("sha256").update(bytes).digest("hex"),
    file = hash + ".webp";
  if (file !== asset.file)
    writeFileSync(resolve(dataDir, "logos", file), bytes);
  db.prepare("INSERT OR IGNORE INTO logo_files VALUES(?,?)").run(hash, file);
  return { ...asset, imageVersion: 2, file, logo: "/api/logos/" + hash };
}
export function publicLink(value) {
  try {
    const u = new URL(value);
    if (
      !/^https?:$/.test(u.protocol) ||
      u.username ||
      u.password ||
      u.port ||
      /^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname) ||
      /^[\d.[\]:]+$/.test(u.hostname)
    )
      return undefined;
    return u.href;
  } catch {
    return undefined;
  }
}

export function enrichGuideReferences(places, reference = guide) {
  let matched = 0;
  for (const [name, sourceCity] of reference.entries) {
    const city = Object.values(CITIES).find(
      (c) =>
        identityKey(c) === identityKey(sourceCity) ||
        identityKey(c) === identityKey(sourceCity.replace(/ City$/, "")),
    );
    if (!city) continue;
    const aliases = [
      name,
      name.replace(new RegExp(`\\s*\\|\\s*${city}$`, "i"), ""),
    ].map(identityKey);
    const matches = places.filter(
      (p) => p.city === city && aliases.includes(identityKey(p.name)),
    );
    // A directory name without coordinates cannot distinguish two identically named branches.
    if (matches.length !== 1) continue;
    const place = matches[0];
    place.guideUrl =
      "https://cafeguideph.com/coffee-shops/" + encodeURIComponent(name);
    place.guideCheckedAt = reference.checkedAt;
    matched++;
  }
  return matched;
}

export function brandIndex(source) {
  const index = new Map();
  for (const category of ["restaurant", "cafe", "fast_food"]) {
    for (const entry of source.nsi?.[`brands/amenity/${category}`]?.items ||
      []) {
      const scope = entry.locationSet;
      if (
        !scope?.include?.some((v) => v === "001" || v === "ph") ||
        scope.exclude?.includes("ph")
      )
        continue;
      const q = entry.tags?.["brand:wikidata"];
      if (!/^Q\d+$/.test(q || "")) continue;
      for (const name of [
        entry.tags.brand,
        entry.tags.name,
        entry.tags.official_name,
        ...(entry.matchNames || []),
      ].filter(Boolean)) {
        const key = identityKey(name);
        if (!index.has(key)) index.set(key, q);
        else if (index.get(key) !== q) index.set(key, null); // Ambiguous names must not acquire another brand's logo.
      }
    }
  }
  return index;
}

function rings(members, role) {
  const segments = members
    .filter((m) => m.role === role && m.geometry?.length)
    .map((m) => m.geometry.map((p) => [p.lon, p.lat]));
  const result = [];
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  while (segments.length) {
    const ring = segments.pop();
    while (!same(ring[0], ring.at(-1))) {
      const end = ring.at(-1);
      const i = segments.findIndex(
        (s) => same(s[0], end) || same(s.at(-1), end),
      );
      if (i < 0)
        throw new Error(
          "Incomplete city boundary geometry; existing directory retained.",
        );
      const segment = segments.splice(i, 1)[0];
      if (!same(segment[0], end)) segment.reverse();
      ring.push(...segment.slice(1));
    }
    result.push(ring);
  }
  return result;
}
function inside(point, ring) {
  const [x, y] = point;
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      result = !result;
  }
  return result;
}
export function boundaries(elements) {
  return Object.entries(CITIES).map(([id, name]) => {
    const relation = elements.find(
      (e) =>
        e.type === "relation" &&
        e.id === Number(id) &&
        e.tags?.admin_level === "6",
    );
    if (!relation?.members)
      throw new Error(
        `Missing ${name} boundary; incomplete Metro Manila scan was rejected.`,
      );
    const outer = rings(relation.members, "outer"),
      inner = rings(relation.members, "inner");
    if (!outer.length) throw new Error(`Missing ${name} boundary geometry.`);
    const points = outer.flat();
    return {
      name,
      outer,
      inner,
      box: [
        Math.min(...points.map((p) => p[0])),
        Math.min(...points.map((p) => p[1])),
        Math.max(...points.map((p) => p[0])),
        Math.max(...points.map((p) => p[1])),
      ],
    };
  });
}
export function cityFor(lat, lng, cities, fallback) {
  for (const c of cities) {
    if (lng < c.box[0] || lat < c.box[1] || lng > c.box[2] || lat > c.box[3])
      continue;
    if (
      c.outer.some((r) => inside([lng, lat], r)) &&
      !c.inner.some((r) => inside([lng, lat], r))
    )
      return c.name;
  }
  return (
    Object.values(CITIES).find(
      (c) => identityKey(c) === identityKey(fallback || ""),
    ) || "Metro Manila"
  );
}

const officialMenus = {
  Q37158: "https://www.starbucks.ph/menu",
  Q37614: "https://www.jollibee.com.ph/menu/",
};
export function metroOverpassQuery() {
  const cityRelations = Object.keys(CITIES)
    .map((id) => `relation(${id});`)
    .join("");
  return `[out:json][timeout:60];area(${AREA_RELATION_OFFSET + METRO_MANILA_RELATION_ID})->.metro;relation(${METRO_MANILA_RELATION_ID});out tags;nwr["amenity"~"^(restaurant|cafe|fast_food|food_court)$"](area.metro);out center tags;(${cityRelations});out geom;`;
}
export function normalizePlace(
  e,
  { index = new Map(), cities = [], now = Date.now() } = {},
) {
  const t = e.tags || {},
    lat = e.lat ?? e.center?.lat,
    lng = e.lon ?? e.center?.lon;
  if (
    !/^(node|way|relation)$/.test(e.type) ||
    !Number.isSafeInteger(e.id) ||
    e.id <= 0 ||
    !/^(restaurant|cafe|fast_food|food_court)$/.test(t.amenity || "") ||
    !(t.name || t.brand)?.trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 85 ||
    Math.abs(lng) > 180
  )
    return null;
  const q = (t["brand:wikidata"] || t.wikidata || "").split(";")[0];
  const brandId = /^Q\d+$/.test(q)
    ? q
    : index.get(identityKey(t.brand || t.name)) || undefined;
  const café = t.amenity === "cafe";
  const curated = officialSource({
    brandId,
    brandName: t.brand,
    name: t.name,
    category: café ? "Café" : "Restaurant",
  });
  const city = cities.length
    ? cityFor(lat, lng, cities, t["addr:city"])
    : t["addr:city"] || "Nearby";
  const website = publicLink(
    curated?.website ||
      t.website ||
      t["contact:website"] ||
      t["brand:website"] ||
      officialMenus[brandId]?.replace(/\/menu\/?$/, "/"),
  );
  const menuCandidate =
    officialMenus[brandId] ||
    curated?.menu ||
    t["website:menu"] ||
    t.menu ||
    t["contact:menu"];
  const menuUrl = philippineMenu(menuCandidate);
  return {
    id: `osm-${e.type}-${e.id}`,
    name: (t.name || t.brand).trim().slice(0, 150),
    category: café ? "Café" : "Restaurant",
    city,
    neighborhood: t["addr:suburb"] || t["addr:district"] || "Mapped location",
    address: [t["addr:housenumber"], t["addr:street"], t["addr:suburb"], city]
      .filter(Boolean)
      .join(" "),
    description: t.cuisine
      ? `Serving ${t.cuisine.replaceAll(";", ", ").replaceAll("_", " ")}. Listed by OpenStreetMap contributors.`
      : "Listed by OpenStreetMap contributors. Share your visit to help others discover it.",
    image: café ? "/images/cafe.jpg" : "/images/restaurant.jpg",
    lat,
    lng,
    budget: 0,
    budgetKnown: false,
    tags: [
      café ? "Coffee & cafés" : "Food & dining",
      ...(t.cuisine
        ? [t.cuisine.replaceAll(";", ", ").replaceAll("_", " ").slice(0, 100)]
        : []),
    ],
    rating: null,
    reviewCount: 0,
    independentVisits: 0,
    sample: false,
    hours: t.opening_hours || "Hours not listed",
    sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
    brandId,
    brandName: t.brand,
    website,
    websiteCountry: philippineWebsite(website) ? "PH" : undefined,
    menuUrl,
    menuCountry: menuUrl ? "PH" : undefined,
    menuUnavailableReason:
      menuCandidate && !menuUrl ? "country_unconfirmed" : undefined,
    menuSource: menuUrl
      ? officialMenus[brandId] || curated?.menu
        ? "Official Philippine menu"
        : "Philippine menu listed on OpenStreetMap"
      : undefined,
    priceText: t.charge?.slice(0, 200),
    priceSource: t.charge
      ? `https://www.openstreetmap.org/${e.type}/${e.id}`
      : undefined,
    checkedAt: now,
    mapStatus: "confirmed",
    catalogRegion: cities.length ? "Metro Manila" : undefined,
  };
}

export function initializeCatalog(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS catalog_state(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS brand_assets(id TEXT PRIMARY KEY, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS logo_files(id TEXT PRIMARY KEY, file TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS place_changes(id INTEGER PRIMARY KEY, place_id TEXT NOT NULL, fields TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS menu_sources(url TEXT PRIMARY KEY, data TEXT NOT NULL);`);
  db.exec(
    "CREATE TABLE IF NOT EXISTS website_assets(url TEXT PRIMARY KEY, data TEXT NOT NULL)",
  );
}
export function catalogStatus(db) {
  initializeCatalog(db);
  const record = db.prepare("SELECT data FROM catalog_state WHERE id=1").get();
  const state = record
    ? JSON.parse(record.data)
    : { status: "not_started", cities: [], count: 0 };
  const hasMuseums = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='museum_catalog_state'",
    )
    .get();
  const museums =
    hasMuseums &&
    db.prepare("SELECT data FROM museum_catalog_state WHERE id=1").get();
  if (museums) state.museums = JSON.parse(museums.data);
  const hasCinemas = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cinema_catalog_state'",
    )
    .get();
  const cinemas =
    hasCinemas &&
    db.prepare("SELECT data FROM cinema_catalog_state WHERE id=1").get();
  if (cinemas) state.cinemas = JSON.parse(cinemas.data);
  return state;
}
function saveStatus(db, value) {
  db.prepare(
    "INSERT INTO catalog_state VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
  ).run(JSON.stringify(value));
}
export function importPlaces(
  db,
  places,
  now = Date.now(),
  authoritative = false,
  newOnly = false,
) {
  const get = db.prepare("SELECT data FROM places WHERE id=?"),
    put = db.prepare(
      "INSERT INTO places(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    );
  const change = db.prepare(
    "INSERT INTO place_changes(place_id,fields,created_at) VALUES(?,?,?)",
  );
  let added = 0,
    changed = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const place of places) {
      const old = get.get(place.id),
        previous = old ? JSON.parse(old.data) : null;
      if (newOnly && previous) continue;
      // A nearby lookup must retain region membership and previously verified brand assets.
      const sameBrand =
        previous?.brandId === place.brandId && previous?.name === place.name;
      const previousMenu =
        !authoritative ||
        (previous?.menuUrl === place.menuUrl &&
          ["restricted", "unavailable"].includes(place.menuStatus))
          ? philippineMenu(previous?.menuUrl)
          : undefined;
      const merged = {
        ...place,
        logo:
          place.logo ||
          (!authoritative && sameBrand ? previous?.logo : undefined),
        logoSource:
          place.logoSource ||
          (!authoritative && sameBrand ? previous?.logoSource : undefined),
        menuUrl: place.menuUrl || previousMenu,
        menuCountry: place.menuCountry || (previousMenu ? "PH" : undefined),
        menuSource:
          place.menuSource || (previousMenu ? previous?.menuSource : undefined),
        menuStatus:
          place.menuStatus || (previousMenu ? previous?.menuStatus : undefined),
        menuCheckedAt:
          place.menuCheckedAt ||
          (previousMenu ? previous?.menuCheckedAt : undefined),
        priceText:
          place.priceText || (previousMenu ? previous?.priceText : undefined),
        priceCheckedAt:
          place.priceCheckedAt ||
          (previousMenu ? previous?.priceCheckedAt : undefined),
        priceSource:
          place.priceSource ||
          (previousMenu ? previous?.priceSource : undefined),
        catalogRegion: place.catalogRegion || previous?.catalogRegion,
        guideUrl:
          place.guideUrl || (!authoritative ? previous?.guideUrl : undefined),
        guideCheckedAt:
          place.guideCheckedAt ||
          (!authoritative ? previous?.guideCheckedAt : undefined),
        city:
          place.city === "Nearby" ? previous?.city || place.city : place.city,
        websiteStatus:
          place.websiteStatus ||
          (!authoritative && previous?.website === place.website
            ? previous?.websiteStatus
            : undefined),
      };
      if (!authoritative && previous?.category === "Museum") {
        for (const field of [
          "museumDirectoryUrl",
          "museumDirectoryUrls",
          "museumCheckedAt",
          "admissionText",
          "admissionSource",
          "visitingNotice",
          "locationStatus",
          "locationSource",
          "detailsSource",
        ])
          if (merged[field] === undefined) merged[field] = previous[field];
      }
      if (previous) {
        const fields = [
          "name",
          "hours",
          "menuUrl",
          "priceText",
          "website",
          "websiteStatus",
          "logo",
          "address",
          "lat",
          "lng",
          "brandId",
          "mapStatus",
          "admissionText",
          "visitingNotice",
          "locationStatus",
        ].filter((k) =>
          k === "mapStatus"
            ? (previous[k] || "confirmed") !== (merged[k] || "confirmed")
            : previous[k] !== merged[k],
        );
        if (fields.length) {
          changed++;
          change.run(place.id, JSON.stringify(fields), now);
        }
      } else added++;
      put.run(place.id, JSON.stringify(merged));
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { added, changed };
}

export function reconcileMissingPlaces(db, places, now = Date.now()) {
  const seen = new Set(places.map((p) => p.id));
  const put = db.prepare("UPDATE places SET data=? WHERE id=?");
  const change = db.prepare(
    "INSERT INTO place_changes(place_id,fields,created_at) VALUES(?,?,?)",
  );
  let newlyUnconfirmed = 0,
    unconfirmed = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of db.prepare("SELECT id,data FROM places").all()) {
      const p = JSON.parse(row.data);
      if (
        p.catalogRegion !== "Metro Manila" ||
        p.category === "Museum" ||
        p.category === "Cinema" ||
        seen.has(row.id)
      )
        continue;
      unconfirmed++;
      if (p.mapStatus === "unconfirmed") continue;
      p.mapStatus = "unconfirmed";
      p.missingSince = now;
      put.run(JSON.stringify(p), row.id);
      change.run(row.id, '["mapStatus"]', now);
      newlyUnconfirmed++;
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { newlyUnconfirmed, unconfirmed };
}

async function fetchJson(url, fetcher, timeout = 30000) {
  const r = await fetcher(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      "User-Agent":
        "Dated/1.0 (Metro Manila restaurant directory; local pilot)",
    },
  });
  if (!r.ok) throw new Error(`Source returned HTTP ${r.status}`);
  return r.json();
}
export async function loadBrandIndex(
  dataDir,
  fetcher = fetch,
  refresh = false,
) {
  const path = resolve(dataDir, "nsi-source.json");
  if (!existsSync(path) || refresh) {
    try {
      const release = await fetchJson(
        "https://registry.npmjs.org/name-suggestion-index/latest",
        fetcher,
      );
      if (!/^\d+\.\d+\.\d+$/.test(release.version))
        throw new Error("Invalid brand index release");
      const source = await fetchJson(
        `https://cdn.jsdelivr.net/npm/name-suggestion-index@${release.version}/dist/json/nsi.min.json`,
        fetcher,
      );
      if (!source.nsi) throw new Error("Invalid brand index");
      writeFileSync(path, JSON.stringify(source));
    } catch (e) {
      if (!existsSync(path)) throw e;
    }
  }
  return brandIndex(JSON.parse(readFileSync(path, "utf8")));
}

export async function enrichLogos(
  db,
  dataDir,
  places,
  {
    fetcher = fetch,
    now = Date.now(),
    progress = () => {},
    force = false,
  } = {},
) {
  initializeCatalog(db);
  mkdirSync(resolve(dataDir, "logos"), { recursive: true });
  const ids = [...new Set(places.map((p) => p.brandId).filter(Boolean))];
  const get = db.prepare("SELECT data FROM brand_assets WHERE id=?"),
    put = db.prepare(
      "INSERT INTO brand_assets VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    );
  const assets = new Map(),
    missing = [];
  for (const id of ids) {
    const saved = get.get(id),
      asset = saved ? JSON.parse(saved.data) : null;
    if (asset) assets.set(id, asset);
    if (
      force ||
      !asset ||
      asset.checkedAt < now - WEEK ||
      (asset.logo && !existsSync(resolve(dataDir, "logos", asset.file)))
    )
      missing.push(id);
  }
  const websitesMissing = ids.filter(
    (id) =>
      !missing.includes(id) && assets.get(id)?.officialWebsite === undefined,
  );
  for (let start = 0; start < websitesMissing.length; start += 50) {
    const batch = websitesMissing.slice(start, start + 50);
    try {
      const url = new URL("https://www.wikidata.org/w/api.php");
      url.search = new URLSearchParams({
        action: "wbgetentities",
        ids: batch.join("|"),
        props: "claims",
        format: "json",
      }).toString();
      const data = await fetchJson(url, fetcher);
      for (const id of batch) {
        const officialWebsite =
          publicLink(
            data.entities?.[id]?.claims?.P856?.find(
              (c) => c.rank !== "deprecated",
            )?.mainsnak?.datavalue?.value,
          ) || null;
        const asset = { ...assets.get(id), officialWebsite };
        assets.set(id, asset);
        put.run(id, JSON.stringify(asset));
      }
    } catch {
      break;
    }
  }
  // Process every identity in API-sized batches, rather than silently dropping brands after 40.
  for (let start = 0; start < missing.length; start += 50) {
    const batch = missing.slice(start, start + 50);
    try {
      const url = new URL("https://www.wikidata.org/w/api.php");
      url.search = new URLSearchParams({
        action: "wbgetentities",
        ids: batch.join("|"),
        props: "claims",
        format: "json",
      }).toString();
      const data = await fetchJson(url, fetcher);
      if (!data.entities) throw new Error("Invalid brand metadata response");
      for (const id of batch) {
        const claims = data.entities[id]?.claims?.P154 || [];
        const filename = [...claims]
          .sort(
            (a, b) =>
              (a.rank === "preferred" ? -1 : 0) -
              (b.rank === "preferred" ? -1 : 0),
          )
          .find((c) => c.rank !== "deprecated")?.mainsnak?.datavalue?.value;
        const officialWebsite =
          publicLink(
            data.entities[id]?.claims?.P856?.find(
              (c) => c.rank !== "deprecated",
            )?.mainsnak?.datavalue?.value,
          ) ||
          assets.get(id)?.officialWebsite ||
          null;
        let asset = {
          checkedAt: now,
          status: "not_published",
          officialWebsite,
        };
        if (typeof filename === "string" && filename.length < 300) {
          const source =
            "https://commons.wikimedia.org/wiki/File:" +
            encodeURIComponent(filename);
          try {
            const image = await fetcher(
              "https://commons.wikimedia.org/wiki/Special:FilePath/" +
                encodeURIComponent(filename) +
                "?width=160",
              {
                signal: AbortSignal.timeout(15000),
                headers: {
                  "User-Agent": "Dated/1.0 (restaurant brand logo cache)",
                },
              },
            );
            if (
              !image.ok ||
              !image.headers.get("content-type")?.startsWith("image/")
            )
              throw new Error(`Logo source HTTP ${image.status}`);
            const bytes = Buffer.from(await image.arrayBuffer());
            if (bytes.length > 4 * 1024 * 1024)
              throw new Error("Logo exceeds image size limit");
            const webp = await logoBytes(bytes);
            const hash = createHash("sha256").update(webp).digest("hex"),
              file = hash + ".webp";
            writeFileSync(resolve(dataDir, "logos", file), webp);
            db.prepare("INSERT OR IGNORE INTO logo_files VALUES(?,?)").run(
              hash,
              file,
            );
            asset = {
              checkedAt: now,
              status: "verified",
              logo: "/api/logos/" + hash,
              logoSource: source,
              file,
              officialWebsite,
              imageVersion: 2,
            };
          } catch (e) {
            asset = {
              ...assets.get(id),
              officialWebsite,
              checkedAt: now,
              status: "unreachable",
              logoSource: source,
              error: e.message,
            };
          }
        }
        assets.set(id, asset);
        put.run(id, JSON.stringify(asset));
        progress({
          identities: ids.length,
          checked: start + batch.indexOf(id) + 1,
        });
      }
    } catch (e) {
      // Keep previously verified assets; a provider outage never deletes a venue.
      progress({ warning: "Brand source unavailable: " + e.message });
      break;
    }
  }
  for (const [id, asset] of assets) {
    const normalized = await ensureLogoContrast(db, dataDir, asset);
    if (normalized !== asset) {
      assets.set(id, normalized);
      put.run(id, JSON.stringify(normalized));
    }
  }
  for (const p of places) {
    const a = assets.get(p.brandId);
    if (!p.website && a?.officialWebsite) p.website = a.officialWebsite;
    if (a?.logo && a.file && existsSync(resolve(dataDir, "logos", a.file))) {
      p.logo = a.logo;
      p.logoSource = a.logoSource;
    }
  }
  return {
    identities: ids.length,
    verifiedBrands: [...assets.values()].filter((a) => a.logo).length,
    unpublishedBrands: [...assets.values()].filter(
      (a) => a.status === "not_published",
    ).length,
    unreachableBrands: [...assets.values()].filter(
      (a) => a.status === "unreachable",
    ).length,
  };
}

export async function syncMetro(
  db,
  dataDir,
  {
    source,
    force = false,
    fetcher = fetch,
    now = Date.now(),
    progress = () => {},
  } = {},
) {
  initializeCatalog(db);
  db.exec("PRAGMA busy_timeout=5000");
  db.exec("BEGIN IMMEDIATE");
  const prior = catalogStatus(db);
  if (prior.status === "running" && prior.leaseUntil > now) {
    db.exec("COMMIT");
    return { ...prior, skipped: "already_running" };
  }
  if (!force && prior.nextDue > now && prior.lastSuccess) {
    db.exec("COMMIT");
    return { ...prior, skipped: "not_due" };
  }
  const token = randomUUID(),
    state = {
      ...prior,
      status: "running",
      token,
      lastAttempt: now,
      leaseUntil: now + 2 * 3600000,
      error: undefined,
    };
  saveStatus(db, state);
  db.exec("COMMIT");
  try {
    let payload = source;
    if (!payload) {
      const endpoint = new URL(
        process.env.DATED_OVERPASS_URL ||
          "https://overpass-api.de/api/interpreter",
      );
      endpoint.searchParams.set("data", metroOverpassQuery());
      payload = await fetchJson(endpoint, fetcher, 150000);
    }
    if (
      !Array.isArray(payload.elements) ||
      payload.remark ||
      !payload.elements.some((e) => e.tags?.["ISO3166-2"] === "PH-00")
    )
      throw new Error(
        "Incomplete Metro Manila response; existing records retained.",
      );
    const cities = boundaries(payload.elements),
      index = await loadBrandIndex(dataDir, fetcher, !source);
    const places = payload.elements
      .map((e) => normalizePlace(e, { cities, index, now }))
      .filter(Boolean);
    if (!places.length) throw new Error("Empty Metro Manila scan rejected.");
    const guideMatches = enrichGuideReferences(places);
    const counts = cities.map((c) => ({
      name: c.name,
      count: places.filter((p) => p.city === c.name).length,
    }));
    // Provider failures must not turn a partial response into mass listing removals.
    if (
      (prior.count && places.length < prior.count * 0.7) ||
      counts.some((c) => {
        const before = prior.cities?.find((v) => v.name === c.name)?.count;
        return before >= 20 && c.count < before * 0.6;
      })
    )
      throw new Error(
        "Unexpected drop in mapped places; existing directory retained. Retry the full scan.",
      );
    if (
      prior.sourceTimestamp &&
      payload.osm3s?.timestamp_osm_base &&
      Date.parse(payload.osm3s.timestamp_osm_base) <
        Date.parse(prior.sourceTimestamp)
    )
      throw new Error(
        "Older map snapshot rejected; existing directory retained.",
      );
    progress({ phase: "places", count: places.length, cities: counts });
    // Import listings before slow media checks. All retain a usable rating journey.
    const listingChanges = importPlaces(db, places, now, false, true);
    const logoStats = await enrichLogos(db, dataDir, places, {
      fetcher,
      now,
      progress,
      force,
    });
    if (process.env.DATED_SITE_LOGOS !== "false")
      await enrichWebsiteLogos(db, dataDir, places, { now, progress, force });
    await enrichMenus(db, places, { now, progress, force });
    const changes = importPlaces(db, places, now, true);
    const availability = reconcileMissingPlaces(db, places, now);
    const result = {
      status: "ready",
      count: places.length,
      cities: counts,
      lastAttempt: now,
      lastSuccess: now,
      nextDue: now + WEEK,
      enrichmentCheckedAt: now,
      enrichmentNextDue: now + WEEK,
      logos: places.filter((p) => p.logo).length,
      menus: places.filter((p) => p.menuUrl).length,
      prices: places.filter((p) => p.priceText).length,
      missingLogos: places.filter((p) => !p.logo).length,
      withoutBrandIdentity: places.filter((p) => !p.brandId).length,
      guideMatches,
      ...logoStats,
      added: listingChanges.added,
      changed: listingChanges.changed + changes.changed,
      ...availability,
      sourceTimestamp: payload.osm3s?.timestamp_osm_base || null,
      refresh: "weekly",
    };
    saveStatus(db, result);
    // Live full refreshes include museums. Explicit fixtures stay offline and food-only.
    if (!source) {
      const { syncMuseums } = await import("./museum-catalog.mjs");
      try {
        result.museums = await syncMuseums(db, dataDir, {
          force,
          now,
          fetcher,
          boundarySource: payload,
          progress,
        });
      } catch (error) {
        progress({ warning: `Museum refresh delayed: ${error.message}` });
      }
      const { syncCinemas } = await import("./cinema-catalog.mjs");
      try {
        result.cinemas = await syncCinemas(db, dataDir, {
          force,
          now,
          fetcher,
          boundarySource: payload,
          progress,
        });
      } catch (error) {
        progress({ warning: `Cinema refresh delayed: ${error.message}` });
      }
    }
    writeFileSync(
      resolve(dataDir, "catalog-audit.json"),
      JSON.stringify(result, null, 2),
    );
    return result;
  } catch (e) {
    const failed = {
      ...prior,
      status: "error",
      lastAttempt: now,
      error: e.message,
      retryAfter: now + DAY,
    };
    saveStatus(db, failed);
    throw e;
  }
}

export async function enrichWebsiteLogos(
  db,
  dataDir,
  places,
  {
    now = Date.now(),
    progress = () => {},
    reader = publicResource,
    force = false,
  } = {},
) {
  initializeCatalog(db);
  mkdirSync(resolve(dataDir, "logos"), { recursive: true });
  const sourceFor = (p) =>
    officialSource(p)?.logoWebsite || officialSource(p)?.website || p.website;
  const urls = [
    ...new Set(
      places
        .filter(
          (p) =>
            !p.logo &&
            sourceFor(p) &&
            !/(?:facebook|instagram|google|foodpanda|grab|tiktok)\./i.test(
              new URL(sourceFor(p)).hostname,
            ),
        )
        .map(sourceFor),
    ),
  ];
  const results = new Map(),
    get = db.prepare("SELECT data FROM website_assets WHERE url=?"),
    put = db.prepare(
      "INSERT INTO website_assets VALUES(?,?) ON CONFLICT(url) DO UPDATE SET data=excluded.data",
    );
  let position = 0;
  async function worker() {
    while (position < urls.length) {
      const url = urls[position++],
        saved = get.get(url),
        cached = saved ? JSON.parse(saved.data) : null;
      if (
        cached?.identityValidated &&
        cached.extractorVersion === 8 &&
        !force &&
        cached.checkedAt > now - WEEK &&
        (!cached.file || existsSync(resolve(dataDir, "logos", cached.file)))
      ) {
        const normalized = await ensureLogoContrast(db, dataDir, cached);
        if (normalized !== cached) put.run(url, JSON.stringify(normalized));
        results.set(url, normalized);
        continue;
      }
      let result = {
        checkedAt: now,
        status: "not_published",
        identityValidated: true,
        extractorVersion: 8,
      };
      try {
        const page = await reader(url);
        if (page.status < 200 || page.status >= 300)
          throw new Error("Website unavailable");
        if (
          new URL(page.url).hostname.replace(/^www\./, "") !==
          new URL(url).hostname.replace(/^www\./, "")
        )
          throw Object.assign(
            new Error("Website now redirects to another domain"),
            { code: "IDENTITY_CHANGED" },
          );
        if (websiteIdentityChanged(page.bytes.toString("utf8"), page.url))
          throw Object.assign(
            new Error("Website no longer represents the business"),
            { code: "IDENTITY_CHANGED" },
          );
        const names = places
          .filter((p) => sourceFor(p) === url)
          .flatMap((p) => [
            officialSource(p)?.name,
            p.brandName,
            p.name,
            p.name.split(/\s[-–|]\s/)[0],
          ])
          .filter(Boolean);
        const imageUrl = page.headers["content-type"]?.includes("text/html")
          ? publicLink(
              websiteLogo(page.bytes.toString("utf8"), page.url, names),
            )
          : undefined;
        if (imageUrl) {
          const image = await reader(imageUrl, { maxBytes: 4 * 1024 * 1024 });
          if (
            image.status !== 200 ||
            !image.headers["content-type"]?.startsWith("image/")
          )
            throw new Error("Website logo unavailable");
          const bytes = await logoBytes(image.bytes);
          const hash = createHash("sha256").update(bytes).digest("hex"),
            file = hash + ".webp";
          writeFileSync(resolve(dataDir, "logos", file), bytes);
          db.prepare("INSERT OR IGNORE INTO logo_files VALUES(?,?)").run(
            hash,
            file,
          );
          result = {
            checkedAt: now,
            status: "verified",
            identityValidated: true,
            extractorVersion: 8,
            logo: "/api/logos/" + hash,
            logoSource: page.url,
            file,
            imageVersion: 2,
          };
        }
      } catch (error) {
        result = {
          ...(error.code !== "IDENTITY_CHANGED" &&
          cached?.identityValidated &&
          cached.extractorVersion >= 3
            ? cached
            : {}),
          identityValidated: true,
          extractorVersion: 8,
          checkedAt: now,
          status:
            error.code === "IDENTITY_CHANGED"
              ? "identity_unconfirmed"
              : "unreachable",
        };
      }
      put.run(url, JSON.stringify(result));
      results.set(url, result);
      if (results.size % 20 === 0)
        progress({
          phase: "websites",
          checked: results.size,
          total: urls.length,
        });
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  for (const p of places) {
    const asset = results.get(sourceFor(p));
    if (asset?.status === "identity_unconfirmed" && sourceFor(p) === p.website)
      p.websiteStatus = "identity_unconfirmed";
    if (
      !p.logo &&
      asset?.logo &&
      existsSync(resolve(dataDir, "logos", asset.file))
    ) {
      p.logo = asset.logo;
      p.logoSource = asset.logoSource;
    }
  }
}

export async function enrichMenus(
  db,
  places,
  {
    now = Date.now(),
    progress = () => {},
    reader = publicResource,
    force = false,
  } = {},
) {
  initializeCatalog(db);
  const urls = [...new Set(places.map((p) => p.menuUrl).filter(Boolean))],
    results = new Map();
  const get = db.prepare("SELECT data FROM menu_sources WHERE url=?"),
    put = db.prepare(
      "INSERT INTO menu_sources VALUES(?,?) ON CONFLICT(url) DO UPDATE SET data=excluded.data",
    );
  let position = 0;
  async function worker() {
    while (position < urls.length) {
      const url = urls[position++],
        saved = get.get(url),
        cached = saved ? JSON.parse(saved.data) : null;
      if (
        cached?.countryVerified === "PH" &&
        !force &&
        cached?.checkedAt > now - WEEK &&
        (!/^(?:www\.)?pickup-coffee\.com$/.test(new URL(url).hostname) ||
          cached.priceParserVersion === 2)
      ) {
        results.set(url, cached);
        continue;
      }
      let result;
      try {
        const response = await reader(url);
        const countryVerified =
          philippineMenu(response.url || url) &&
          !websiteIdentityChanged(
            response.bytes.toString("utf8"),
            response.url || url,
          )
            ? "PH"
            : undefined;
        const ok =
          response.status >= 200 &&
          response.status < 300 &&
          !!countryVerified &&
          !websiteIdentityChanged(
            response.bytes.toString("utf8"),
            response.url || url,
          );
        result = {
          checkedAt: now,
          priceParserVersion: 2,
          countryVerified,
          status: !countryVerified
            ? "unverified"
            : ok
              ? "reachable"
              : [401, 403, 429].includes(response.status)
                ? "restricted"
                : "unavailable",
          priceText:
            ok && response.headers["content-type"]?.includes("text/html")
              ? publishedMenuPrices(
                  response.bytes.toString("utf8"),
                  response.url || url,
                )
              : undefined,
        };
      } catch {
        result = {
          checkedAt: now,
          priceParserVersion: 2,
          status: "unavailable",
          countryVerified: philippineMenu(url) ? "PH" : undefined,
        };
      }
      // Missing or blocked prices are kept unknown rather than treated as free.
      results.set(url, result);
      put.run(url, JSON.stringify(result));
      progress({ phase: "menus", checked: results.size, total: urls.length });
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  for (const p of places) {
    const result = results.get(p.menuUrl);
    if (result) {
      p.menuStatus = result.status;
      p.menuCheckedAt = result.checkedAt;
      p.menuCountry = result.countryVerified;
      if (result.status === "unverified") {
        p.menuUrl = undefined;
        p.menuSource = undefined;
        p.menuUnavailableReason = "country_unconfirmed";
      }
      if (result.priceText) {
        p.priceText = result.priceText;
        p.priceSource = p.menuUrl;
        p.priceCheckedAt = result.checkedAt;
      } else if (result.status === "reachable" && p.priceSource === p.menuUrl) {
        p.priceText = undefined;
        p.priceSource = undefined;
        p.priceCheckedAt = undefined;
      }
    }
  }
}

export async function refreshMetroEnrichment(
  db,
  dataDir,
  {
    force = false,
    fetcher = fetch,
    now = Date.now(),
    progress = () => {},
    reader = publicResource,
  } = {},
) {
  initializeCatalog(db);
  const prior = catalogStatus(db);
  if (!force && prior.enrichmentNextDue > now && prior.enrichmentCheckedAt)
    return { ...prior.enrichment, skipped: "not_due" };

  const places = db
    .prepare("SELECT data FROM places")
    .all()
    .map((row) => JSON.parse(row.data))
    .filter(
      (place) =>
        !place.sample &&
        place.catalogRegion === "Metro Manila" &&
        ["Restaurant", "Café"].includes(place.category),
    );
  if (!places.length)
    throw new Error(
      "No saved Metro Manila food listings are available to refresh.",
    );

  const logos = await enrichLogos(db, dataDir, places, {
    fetcher,
    now,
    progress,
    force,
  });
  if (process.env.DATED_SITE_LOGOS !== "false")
    await enrichWebsiteLogos(db, dataDir, places, {
      now,
      progress,
      reader,
      force,
    });
  await enrichMenus(db, places, { now, progress, reader, force });
  const changes = importPlaces(db, places, now, true);
  const result = {
    checkedAt: now,
    nextDue: now + WEEK,
    count: places.length,
    logos: places.filter((place) => place.logo).length,
    menus: places.filter((place) => place.menuUrl).length,
    prices: places.filter((place) => place.priceText).length,
    changed: changes.changed,
    ...logos,
  };
  saveStatus(db, {
    ...prior,
    enrichmentCheckedAt: now,
    enrichmentNextDue: now + WEEK,
    enrichment: result,
  });
  writeFileSync(
    resolve(dataDir, "enrichment-audit.json"),
    JSON.stringify(result, null, 2),
  );
  return result;
}
