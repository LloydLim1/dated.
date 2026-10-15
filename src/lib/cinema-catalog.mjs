import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fetchOverpassData } from "./overpass-source.mjs";
import {
  WEEK,
  boundaries,
  normalizePlace,
  initializeCatalog,
  importPlaces,
  enrichLogos,
  enrichWebsiteLogos,
} from "./place-catalog.mjs";
export function normalizeCinema(e, options = {}) {
  if (
    e.tags?.amenity !== "cinema" ||
    /^(lotto|music museum)$/i.test(e.tags?.name || "")
  )
    return null;
  const p = normalizePlace(
    { ...e, tags: { ...e.tags, amenity: "restaurant" } },
    options,
  );
  return p
    ? {
        ...p,
        category: "Cinema",
        image: "/images/cinema.jpg",
        tags: ["Movies & cinema"],
        description:
          "A cinema listed by OpenStreetMap contributors. Check the cinema’s official website for current films, schedules and ticket prices.",
        menuUrl: undefined,
        menuSource: undefined,
        menuCountry: undefined,
        menuUnavailableReason: undefined,
        priceText: undefined,
        priceSource: undefined,
        detailsSource: "OpenStreetMap",
      }
    : null;
}
export function cinemaStatus(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS cinema_catalog_state(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL)",
  );
  const row = db
    .prepare("SELECT data FROM cinema_catalog_state WHERE id=1")
    .get();
  return row ? JSON.parse(row.data) : { status: "not_started", count: 0 };
}
const save = (db, state) =>
  db
    .prepare(
      "INSERT INTO cinema_catalog_state VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    )
    .run(JSON.stringify(state));
export async function syncCinemas(
  db,
  dataDir,
  {
    source,
    boundarySource,
    force = false,
    now = Date.now(),
    fetcher = fetch,
    progress = () => {},
  } = {},
) {
  initializeCatalog(db);
  mkdirSync(dataDir, { recursive: true });
  db.exec("BEGIN IMMEDIATE");
  const prior = cinemaStatus(db);
  if (
    (prior.leaseUntil > now && prior.status === "running") ||
    (!force && prior.lastSuccess && prior.nextDue > now)
  ) {
    db.exec("COMMIT");
    return { ...prior, skipped: true };
  }
  save(db, {
    ...prior,
    status: "running",
    lastAttempt: now,
    leaseUntil: now + 2 * 3600000,
  });
  db.exec("COMMIT");
  try {
    let sourceEndpoint;
    if (!source) {
      const result = await fetchOverpassData(
        '[out:json][timeout:60];area["ISO3166-2"="PH-00"]->.metro;nwr["amenity"="cinema"](area.metro);out center tags;rel(area.metro)["boundary"="administrative"]["admin_level"="6"];out geom;',
        {
          fetcher,
          timeout: 90000,
          progress,
          userAgent: "Dated/1.0 (Metro Manila cinema updates)",
          validate(data) {
            if (!data.elements.some((e) => e.tags?.amenity === "cinema"))
              throw new Error("Incomplete cinema map response.");
            boundaries(data.elements);
          },
        },
      );
      source = result.data;
      sourceEndpoint = result.endpoint;
    }
    if (!Array.isArray(source.elements) || source.remark)
      throw Error("Incomplete cinema response");
    const cities = boundaries(boundarySource?.elements || source.elements),
      places = source.elements
        .map((e) => normalizeCinema(e, { cities, now }))
        .filter((p) => p && p.city !== "Metro Manila");
    if (!places.length || (prior.count && places.length < prior.count * 0.7))
      throw Error("Incomplete cinema scan; previous listings retained");
    await enrichLogos(db, dataDir, places, { fetcher, now, progress });
    if (process.env.DATED_SITE_LOGOS !== "false")
      await enrichWebsiteLogos(db, dataDir, places, { now, progress });
    const previous = db
      .prepare("SELECT data FROM places")
      .all()
      .map((r) => JSON.parse(r.data))
      .filter(
        (p) =>
          p.category === "Cinema" &&
          !p.sample &&
          p.catalogRegion === "Metro Manila",
      );
    const imported = importPlaces(db, places, now, true),
      seen = new Set(places.map((p) => p.id));
    let unconfirmed = 0;
    for (const p of previous)
      if (!seen.has(p.id)) {
        unconfirmed++;
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
      count: places.length,
      logos: places.filter((p) => p.logo).length,
      ...imported,
      unconfirmed,
      lastAttempt: now,
      lastSuccess: now,
      nextDue: now + WEEK,
      ...(sourceEndpoint ? { sourceEndpoint } : {}),
    };
    save(db, state);
    writeFileSync(
      resolve(dataDir, "cinema-audit.json"),
      JSON.stringify(state, null, 2),
    );
    return state;
  } catch (error) {
    save(db, {
      ...prior,
      status: "error",
      lastAttempt: now,
      retryAfter: now + 3600000,
      error: error.message,
    });
    throw error;
  }
}
