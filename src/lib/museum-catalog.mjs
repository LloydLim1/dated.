import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { publicResource } from "./public-resource.mjs";
import { fetchOverpassData } from "./overpass-source.mjs";
import {
  WEEK,
  CITIES,
  boundaries,
  cityFor,
  normalizePlace,
  publicLink,
  initializeCatalog,
  importPlaces,
  enrichLogos,
  enrichWebsiteLogos,
} from "./place-catalog.mjs";

const ROOT = "https://philippinemuseums.com";
const key = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function museumText(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([\da-f]+);|&#(\d+);/gi, (_, hex, dec) =>
      String.fromCodePoint(
        Math.min(0x10ffff, parseInt(hex || dec, hex ? 16 : 10)),
      ),
    )
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const directoryUrl = (url) => {
  try {
    const u = new URL(url);
    return u.origin === ROOT && /^\/museums\/[a-z0-9%-]+\/$/.test(u.pathname)
      ? u.href
      : undefined;
  } catch {
    return undefined;
  }
};
export function parseMuseumDetail(html, url, id) {
  if (!directoryUrl(url) || !Number.isSafeInteger(id) || id <= 0)
    throw new Error("Invalid museum directory identity");
  const name = museumText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  if (!name) throw new Error("Museum name missing");
  const fields = new Map(
    [
      ...html.matchAll(
        /<div\b[^>]*class=["'][^"']*museum-field[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
      ),
    ].map((m) => [
      museumText(m[1].match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)?.[1]),
      m[1].match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] || "",
    ]),
  );
  let lat, lng, osmId;
  for (const match of html.matchAll(
    /(?:href|src)=["'](https:\/\/www\.openstreetmap\.org\/[^"']+)["']/gi,
  )) {
    const u = new URL(match[1].replaceAll("&amp;", "&"));
    const marker = u.searchParams.get("marker") || u.searchParams.get("to");
    if (marker && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(marker))
      [lat, lng] = marker.split(",").map(Number);
    if (u.searchParams.has("mlat") && u.searchParams.has("mlon")) {
      lat = Number(u.searchParams.get("mlat"));
      lng = Number(u.searchParams.get("mlon"));
    }
    const object = u.pathname.match(/^\/(node|way|relation)\/(\d+)$/);
    if (object) osmId = `osm-${object[1]}-${object[2]}`;
  }
  const rawHours = museumText(fields.get("Hours"));
  const admission = museumText(fields.get("Admission"));
  return {
    id,
    url,
    name,
    address: museumText(fields.get("Address")).slice(0, 400),
    hours:
      rawHours && !/^https?:|^(?:no info|n\/a|manila)$/i.test(rawHours)
        ? rawHours.slice(0, 300)
        : undefined,
    admissionText: /^(?:FREE|₱|PHP|P\d)/i.test(admission)
      ? admission.slice(0, 300)
      : undefined,
    visitingNotice: /temporarily closed/i.test(admission + " " + rawHours)
      ? "The directory reports this museum as temporarily closed. Confirm reopening before visiting."
      : undefined,
    website: publicLink(
      fields.get("Website")?.match(/href=["']([^"']+)["']/i)?.[1],
    ),
    lat,
    lng,
    osmId,
  };
}

export function museumStatus(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS museum_catalog_state(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL)",
  );
  const row = db
    .prepare("SELECT data FROM museum_catalog_state WHERE id=1")
    .get();
  return row ? JSON.parse(row.data) : { status: "not_started", count: 0 };
}
function save(db, state) {
  db.prepare(
    "INSERT INTO museum_catalog_state VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
  ).run(JSON.stringify(state));
}
const distance = (a, b) =>
  [a.lat, a.lng, b.lat, b.lng].every(Number.isFinite)
    ? Math.hypot((a.lat - b.lat) * 111000, (a.lng - b.lng) * 107500)
    : Infinity;
// Alternate names from the directory and map. Distinct branches are never merged by name alone.
const aliases = [
  [
    "UST Museum",
    "UST Museum of Arts and Sciences",
    "UST Museum of Arts & Sciences",
  ],
  ["San Agustin Museum", "San Agustin Church Museum"],
  [
    "Museum of the Chinese in Philippine Life",
    "Bahay Tsinoy",
    "Bahay Tsinoy Museum of Chinese in Philippine Life",
  ],
  ["Presidential Museum and Library", "Malacañang Presidential Museum"],
  [
    "Philippine Air Force Aerospace Museum",
    "Aerospace Museum of the Philippine Air Force",
  ],
  ["Space and Time Cube+", "Space & Time Cube+"],
  ["Museo ng Makati", "Makati Museum"],
  ["Jose P. Laurel Museum", "Jose P. Laurel Museum and Library"],
  ["Museo ng Sapatos", "Marikina Shoe Museum"],
  [
    "Rizal Shrine",
    "Fort Santiago Museo ni Rizal",
    "Museo ni Jose Rizal – Fort Santiago",
  ],
  ["Quezon City Memorial Shrine Museum", "Museo ni Manuel Quezon"],
  ["Museo ni Apolinario Mabini – PUP", "Apolinario Mabini Shrine Manila"],
  [
    "Iglesia ni Cristo Museum and Gallery",
    "INC Museum and Gallery",
    "INC Museum",
  ],
];
const nameKey = (name) => {
  const k = key(name);
  const group = aliases.find((a) => a.some((s) => key(s) === k));
  return group ? key(group[0]) : k;
};
const sameName = (a, b) =>
  nameKey(a) === nameKey(b) ||
  (Math.min(nameKey(a).length, nameKey(b).length) >= 10 &&
    (nameKey(a).includes(nameKey(b)) || nameKey(b).includes(nameKey(a))));

export function normalizeMuseum(e, options = {}) {
  if (
    !/^(museum|gallery)$/.test(e.tags?.tourism || "") ||
    (e.type === "relation" && e.tags?.type === "site")
  )
    return null;
  // This map object is the former Roxas Boulevard site; the museum has moved to BGC.
  if (e.type === "way" && e.id === 156307483) return null;
  const p = normalizePlace(
    { ...e, tags: { ...e.tags, amenity: "restaurant" } },
    options,
  );
  if (!p) return null;
  return {
    ...p,
    category: "Museum",
    image: "/images/museum.jpg",
    description:
      "A mapped museum in Metro Manila. Share your visit and check visiting arrangements with the museum.",
    tags: ["Museums & culture"],
    menuUrl: undefined,
    menuSource: undefined,
    menuCountry: undefined,
    menuUnavailableReason: undefined,
    priceText: undefined,
    priceSource: undefined,
    detailsSource: "OpenStreetMap",
    tourism: e.tags.tourism,
  };
}

export function buildMuseumPlaces(
  records,
  osmSource,
  cityBoundaries,
  previous = [],
  now = Date.now(),
) {
  const mapped = (osmSource.elements || [])
    .map((e) => normalizeMuseum(e, { cities: cityBoundaries, now }))
    .filter((p) => p && p.city !== "Metro Manila");
  const places = mapped.filter((p) => p.tourism === "museum");
  let matched = 0,
    duplicates = 0;
  const unlocated = [],
    aggregate = [];
  for (const original of [...records].sort((a, b) => a.id - b.id)) {
    let r = original;
    if (/national museum of the philippines complex/i.test(r.name)) {
      aggregate.push(r.name);
      continue;
    }
    if (/metropolitan museum/i.test(r.name)) {
      // Current official address overrides stale directory and OSM coordinates.
      r = {
        ...r,
        lat:
          cityFor(r.lat, r.lng, cityBoundaries) === "Taguig"
            ? r.lat
            : undefined,
        lng:
          cityFor(r.lat, r.lng, cityBoundaries) === "Taguig"
            ? r.lng
            : undefined,
        osmId: undefined,
        address: r.address,
        website: "https://metmuseum.ph/",
        locationSource: "https://metmuseum.ph/contact",
        admissionText: r.officialAdmissionText,
        admissionSource: r.officialAdmissionText
          ? "https://metmuseum.ph/visit"
          : undefined,
        hours: r.officialHours || "Check museum website for visiting hours",
      };
    }
    const hasPoint = Number.isFinite(r.lat) && Number.isFinite(r.lng);
    const exact = mapped.filter((p) => nameKey(p.name) === nameKey(r.name));
    const candidates =
      exact.length === 1
        ? exact
        : mapped.filter(
            (p) =>
              p.id === r.osmId ||
              (sameName(p.name, r.name) && (!hasPoint || distance(p, r) < 500)),
          );
    let p = candidates.length === 1 ? candidates[0] : undefined;
    const point = p || r,
      addressCity =
        Object.values(CITIES)
          .filter((s) => s !== "Manila")
          .find((s) => key(r.address).includes(key(s))) ||
        (/\bManila\b/i.test(r.address || "") ? "Manila" : undefined),
      city =
        p || hasPoint
          ? cityFor(point.lat, point.lng, cityBoundaries)
          : addressCity;
    if (!city || city === "Metro Manila") {
      unlocated.push(r.name);
      continue;
    }
    const duplicate = places.find(
      (v) =>
        v.museumDirectoryUrl &&
        sameName(v.name, r.name) &&
        (distance(v, point) < 150 ||
          (!hasPoint &&
            !p &&
            v.locationStatus === "address_only" &&
            v.city === city &&
            nameKey(v.name) === nameKey(r.name))),
    );
    if (duplicate) {
      duplicate.museumDirectoryUrls = [
        ...new Set([
          ...(duplicate.museumDirectoryUrls || [duplicate.museumDirectoryUrl]),
          r.url,
        ]),
      ];
      duplicates++;
      continue;
    }
    const existing = previous.find(
      (v) =>
        v.museumDirectoryUrl === r.url ||
        v.museumDirectoryUrls?.includes(r.url) ||
        (p && v.sourceUrl === p.sourceUrl),
    );
    if (!p)
      p = {
        id: existing?.id || `phmuseum-${r.id}`,
        name: r.name,
        category: "Museum",
        city,
        neighborhood: "Mapped museum",
        address: r.address || city,
        lat: hasPoint ? r.lat : null,
        lng: hasPoint ? r.lng : null,
        locationStatus: hasPoint ? "mapped" : "address_only",
        locationSource: r.locationSource,
        image: "/images/museum.jpg",
        budget: 0,
        budgetKnown: false,
        tags: ["Museums & culture"],
        rating: null,
        reviewCount: 0,
        independentVisits: 0,
        sample: false,
        description:
          "Listed in the Philippine Museums directory. Share your own visit and confirm current visiting arrangements with the museum.",
        sourceUrl: r.url,
        detailsSource: "Philippine Museums",
        catalogRegion: "Metro Manila",
        mapStatus: "confirmed",
        checkedAt: now,
      };
    else {
      matched++;
      if (existing && existing.id !== p.id) {
        const at = places.indexOf(p);
        if (at >= 0) places.splice(at, 1);
        p = { ...p, id: existing.id };
      }
    }
    Object.assign(p, {
      city,
      museumDirectoryUrl: r.url,
      museumDirectoryUrls: [r.url],
      museumCheckedAt: now,
      address:
        p.detailsSource === "Philippine Museums"
          ? p.address
          : r.address || p.address,
      admissionText: r.admissionText,
      admissionSource: r.admissionText ? r.admissionSource || r.url : undefined,
      visitingNotice: r.visitingNotice,
      website: p.website || r.website,
      hours:
        p.hours && p.hours !== "Hours not listed"
          ? p.hours
          : r.hours || "Hours not listed",
    });
    if (!p.locationStatus) p.locationStatus = "mapped";
    if (!places.some((v) => v.id === p.id)) places.push(p);
  }
  return { places, matched, duplicates, unlocated, aggregate };
}

export async function syncMuseums(
  db,
  dataDir,
  {
    source,
    osmSource,
    boundarySource,
    now = Date.now(),
    force = false,
    reader = publicResource,
    fetcher = fetch,
    progress = () => {},
  } = {},
) {
  initializeCatalog(db);
  mkdirSync(dataDir, { recursive: true });
  db.exec("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE");
  const prior = museumStatus(db);
  if (
    (prior.status === "running" && prior.leaseUntil > now) ||
    (!force && prior.nextDue > now && prior.lastSuccess)
  ) {
    db.exec("COMMIT");
    return { ...prior, skipped: true };
  }
  save(db, {
    ...prior,
    status: "running",
    token: randomUUID(),
    leaseUntil: now + 2 * 3600000,
    lastAttempt: now,
  });
  db.exec("COMMIT");
  try {
    let records, sourceEndpoint;
    if (source)
      records = source.records.map((r) =>
        r.html ? parseMuseumDetail(r.html, r.url, r.id) : r,
      );
    else {
      const posts = [];
      for (let page = 1, total = 1; page <= total; page++) {
        const response = await reader(
          `${ROOT}/wp-json/wp/v2/museum?per_page=100&page=${page}`,
          { maxBytes: 2 * 1024 * 1024 },
        );
        if (response.status !== 200)
          throw new Error("Museum directory unavailable");
        const list = JSON.parse(response.bytes);
        if (!Array.isArray(list)) throw new Error("Invalid museum directory");
        posts.push(...list);
        total = Number(response.headers["x-wp-totalpages"] || 1);
        if (total > 10) throw new Error("Unexpected museum directory size");
      }
      if (
        !posts.length ||
        (prior.sourceEntries && posts.length < prior.sourceEntries * 0.7)
      )
        throw new Error(
          "Incomplete museum directory; existing museums retained",
        );
      let at = 0;
      records = [];
      const failed = [];
      await Promise.all(
        Array.from({ length: 3 }, async () => {
          while (at < posts.length) {
            const post = posts[at++];
            try {
              if (!directoryUrl(post.link))
                throw new Error("Invalid public museum link");
              const response = await reader(post.link);
              if (response.status !== 200)
                throw new Error("Museum detail unavailable");
              records.push(
                parseMuseumDetail(
                  response.bytes.toString("utf8"),
                  post.link,
                  post.id,
                ),
              );
            } catch {
              failed.push(post.link);
            }
            if (records.length % 15 === 0)
              progress({
                phase: "museums",
                checked: records.length,
                total: posts.length,
              });
          }
        }),
      );
      if (failed.length)
        throw new Error(
          `${failed.length} museum detail pages could not be checked; existing museums retained`,
        );
    }
    if (!records.length) throw new Error("Empty museum directory rejected");
    // This directory entry still contains free admission and hours from the former site.
    const metropolitan = records.find((r) =>
      /metropolitan museum of manila/i.test(r.name),
    );
    if (metropolitan) {
      try {
        const response = await reader("https://metmuseum.ph/visit");
        const text = museumText(response.bytes.toString("utf8"));
        if (
          response.status === 200 &&
          /BUY TICKETS/i.test(text) &&
          /General Admission/i.test(text)
        )
          metropolitan.officialAdmissionText =
            "Paid admission. Check the official ticket page for current rates, discounts and reservations.";
        if (
          response.status === 200 &&
          /Tuesdays to Fridays\s*\|\s*11:00 AM to 6:00 PM/i.test(text) &&
          /Saturdays and Sundays\s*\|\s*10:00 AM to 6:00 PM/i.test(text)
        )
          metropolitan.officialHours =
            "Tuesday–Friday 11 a.m.–6 p.m.; Saturday–Sunday 10 a.m.–6 p.m. Confirm special schedules with the museum.";
      } catch {
        /* Keep admission unknown if the primary source cannot be checked. */
      }
    }
    if (!osmSource) {
      const result = await fetchOverpassData(
        '[out:json][timeout:60];area["ISO3166-2"="PH-00"]->.metro;.metro out tags;nwr["tourism"~"^(museum|gallery)$"](area.metro);out center tags;rel(area.metro)["boundary"="administrative"]["admin_level"="6"];out geom;',
        {
          fetcher,
          timeout: 90000,
          progress,
          userAgent: "Dated/1.0 (Metro Manila museum updates)",
          validate(data) {
            if (!data.elements.some((e) => e.tags?.tourism === "museum"))
              throw new Error("Incomplete museum map response.");
            boundaries(data.elements);
          },
        },
      );
      osmSource = result.data;
      sourceEndpoint = result.endpoint;
    }
    if (
      !Array.isArray(osmSource.elements) ||
      osmSource.remark ||
      !osmSource.elements.some((e) => e.tags?.tourism === "museum")
    )
      throw new Error("Incomplete museum map response");
    const cityBoundaries = boundaries(
      boundarySource?.elements || osmSource.elements,
    );
    const previous = db
      .prepare("SELECT data FROM places")
      .all()
      .map((r) => JSON.parse(r.data))
      .filter((p) => p.category === "Museum" && !p.sample);
    const result = buildMuseumPlaces(
      records,
      osmSource,
      cityBoundaries,
      previous,
      now,
    );
    if (
      !result.places.length ||
      (prior.count && result.places.length < prior.count * 0.7)
    )
      throw new Error(
        "Unexpected museum count drop; existing museums retained",
      );
    await enrichLogos(db, dataDir, result.places, { fetcher, now, progress });
    if (process.env.DATED_SITE_LOGOS !== "false")
      await enrichWebsiteLogos(db, dataDir, result.places, {
        reader,
        now,
        progress,
      });
    const imported = importPlaces(db, result.places, now, true);
    const seen = new Set(result.places.map((p) => p.id));
    const missing = previous.filter(
      (p) => p.catalogRegion === "Metro Manila" && !seen.has(p.id),
    );
    for (const p of missing) {
      if (p.mapStatus === "unconfirmed") continue;
      p.mapStatus = "unconfirmed";
      p.missingSince = now;
      db.prepare("UPDATE places SET data=? WHERE id=?").run(
        JSON.stringify(p),
        p.id,
      );
      db.prepare(
        "INSERT INTO place_changes(place_id,fields,created_at) VALUES(?,?,?)",
      ).run(p.id, '["mapStatus"]', now);
    }
    const state = {
      status: "ready",
      count: result.places.length,
      sourceEntries: records.length,
      matched: result.matched,
      duplicates: result.duplicates,
      unlocated: result.unlocated,
      aggregate: result.aggregate,
      logos: result.places.filter((p) => p.logo).length,
      admissions: result.places.filter((p) => p.admissionText).length,
      mapped: result.places.filter((p) => p.locationStatus !== "address_only")
        .length,
      addressOnly: result.places.filter(
        (p) => p.locationStatus === "address_only",
      ).length,
      ...imported,
      lastAttempt: now,
      lastSuccess: now,
      nextDue: now + WEEK,
      sourceUrl: ROOT + "/museums/",
      ...(sourceEndpoint ? { sourceEndpoint } : {}),
      unconfirmed: missing.length,
    };
    save(db, state);
    writeFileSync(
      resolve(dataDir, "museum-cache.json"),
      JSON.stringify({ checkedAt: now, records }, null, 2),
    );
    writeFileSync(
      resolve(dataDir, "museum-audit.json"),
      JSON.stringify(state, null, 2),
    );
    return state;
  } catch (error) {
    save(db, {
      ...prior,
      status: "error",
      lastAttempt: now,
      error: error.message,
      retryAfter: now + 3600000,
    });
    throw error;
  }
}
