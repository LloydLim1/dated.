import "server-only";
import { z } from "zod";
import { db, dataDir, row, rows, transaction } from "./db";
import {
  catalogStatus,
  normalizePlace,
  importPlaces,
  enrichLogos,
  brandIndex,
} from "@/lib/place-catalog.mjs";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fail, limit } from "./auth";
import type { Place } from "@/lib/types";
import { normalizeMuseum } from "@/lib/museum-catalog.mjs";
import { normalizeCinema } from "@/lib/cinema-catalog.mjs";

const element = z.object({
  type: z.enum(["node", "way", "relation"]),
  id: z.number().int().positive(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  center: z.object({ lat: z.number(), lon: z.number() }).optional(),
  tags: z.record(z.string(), z.string()).default({}),
});
type Result = {
  places: Place[];
  truncated: boolean;
  fetchedAt: number;
  stale?: boolean;
  warning?: string;
};
const cache = new Map<string, Result>();
const inFlight = new Map<string, Promise<Result>>();
let cooldown = 0;
let active = false;
function previouslyDiscovered(
  lat: number,
  lng: number,
  radius: number,
  warning: string,
): Result | null {
  const distance = (p: Place) => {
    if (p.lat === null || p.lng === null) return Infinity;
    const rad = Math.PI / 180;
    const a =
      Math.sin(((p.lat - lat) * rad) / 2) ** 2 +
      Math.cos(lat * rad) *
        Math.cos(p.lat * rad) *
        Math.sin(((p.lng - lng) * rad) / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const nearby = rows("SELECT data FROM places")
    .map((r) => JSON.parse(String(r.data)) as Place)
    .filter((p) => !p.sample && !!p.sourceUrl && distance(p) <= radius)
    .sort((a, b) => distance(a) - distance(b));
  return nearby.length
    ? {
        places: nearby.slice(0, 1000),
        truncated: nearby.length > 1000,
        fetchedAt: 0,
        stale: true,
        warning,
      }
    : null;
}

export async function discover(search: URLSearchParams): Promise<Result> {
  const input = z
    .object({
      lat: z.coerce.number().min(-85).max(85),
      lng: z.coerce.number().min(-180).max(180),
      radius: z.coerce.number().int().min(300).max(3000).default(1500),
    })
    .parse({
      lat: search.get("lat") ?? undefined,
      lng: search.get("lng") ?? undefined,
      radius: search.get("radius") ?? undefined,
    });
  const lat = Number(input.lat.toFixed(3)),
    lng = Number(input.lng.toFixed(3));
  const key = `${lat}:${lng}:${input.radius}`;
  const catalog = catalogStatus(db);
  if (catalog.lastSuccess && Date.now() - catalog.lastSuccess < 7 * 86400000) {
    const stored = previouslyDiscovered(lat, lng, input.radius, "");
    if (stored)
      return {
        ...stored,
        fetchedAt: catalog.lastSuccess,
        stale: false,
        warning: undefined,
      };
  }
  let prior = cache.get(key);
  if (!prior) {
    const saved = row(
      "SELECT * FROM discovery_searches WHERE key=? AND created_at>?",
      key,
      Date.now() - 10 * 60000,
    );
    if (saved) {
      const places = (JSON.parse(String(saved.place_ids)) as string[]).flatMap(
        (id) => {
          const record = row("SELECT data FROM places WHERE id=?", id);
          return record ? [JSON.parse(String(record.data)) as Place] : [];
        },
      );
      prior = {
        places,
        fetchedAt: Number(saved.created_at),
        truncated: !!saved.truncated,
      };
      cache.set(key, prior);
    }
  }
  if (prior && Date.now() - prior.fetchedAt < 10 * 60000) return prior;
  if (inFlight.has(key)) return inFlight.get(key)!;
  if (Date.now() < cooldown || active) {
    const stored = previouslyDiscovered(
      lat,
      lng,
      input.radius,
      "Live discovery is busy. Showing previously discovered places; details may have changed.",
    );
    if (stored) return stored;
    fail(429, "Restaurant discovery is busy. Try again in a moment.");
  }
  try {
    limit("discovery:global", 60, 3600000);
    if (!process.env.DATED_OVERPASS_URL)
      limit("discovery:public-daily", 100, 86400000);
  } catch (e) {
    const stored = previouslyDiscovered(
      lat,
      lng,
      input.radius,
      "The live search limit was reached. Showing previously discovered places.",
    );
    if (stored) return stored;
    throw e;
  }
  const task = (async () => {
    active = true;
    try {
      const query = `[out:json][timeout:25];(nwr["amenity"~"^(restaurant|cafe|fast_food|food_court|cinema)$"](around:${input.radius},${lat},${lng});nwr["tourism"="museum"](around:${input.radius},${lat},${lng}););out center tags;`;
      const endpoint = new URL(
        process.env.DATED_OVERPASS_URL ||
          "https://overpass-api.de/api/interpreter",
      );
      endpoint.searchParams.set("data", query);
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(35000),
        headers: {
          "User-Agent": "Dated/1.0 (local development restaurant discovery)",
        },
        cache: "no-store",
      });
      if (!response.ok) {
        cooldown = Date.now() + 30000;
        fail(
          503,
          "The restaurant map service is unavailable. Please retry shortly.",
        );
      }
      const payload = await response.json();
      if (!Array.isArray(payload.elements) || payload.remark)
        fail(
          503,
          "The restaurant map service could not finish this search. Try a smaller area.",
        );
      const entries: z.infer<typeof element>[] = payload.elements
        .flatMap((raw: unknown) => {
          const parsed = element.safeParse(raw);
          return parsed.success ? [parsed.data] : [];
        })
        .filter(
          (e: z.infer<typeof element>) =>
            (e.tags.name || e.tags.brand) &&
            Number.isFinite(e.lat ?? e.center?.lat) &&
            Number.isFinite(e.lon ?? e.center?.lon),
        )
        .sort(
          (a: z.infer<typeof element>, b: z.infer<typeof element>) =>
            ((a.lat ?? a.center!.lat) - lat) ** 2 +
            ((a.lon ?? a.center!.lon) - lng) ** 2 -
            (((b.lat ?? b.center!.lat) - lat) ** 2 +
              ((b.lon ?? b.center!.lon) - lng) ** 2),
        );
      const selected = entries.slice(0, 1000);
      const indexPath = resolve(dataDir, "nsi-source.json");
      const index = existsSync(indexPath)
        ? brandIndex(JSON.parse(readFileSync(indexPath, "utf8")))
        : new Map();
      const places = selected
        .map((e) =>
          e.tags.amenity === "cinema"
            ? normalizeCinema(e, { index })
            : e.tags.tourism === "museum"
              ? normalizeMuseum(e, { index })
              : normalizePlace(e, { index }),
        )
        .filter(Boolean) as Place[];
      await enrichLogos(db, dataDir, places);
      importPlaces(db, places);
      // Read merged records so local discovery doesn't replace verified catalog details.
      for (let i = 0; i < places.length; i++)
        places[i] = JSON.parse(
          String(row("SELECT data FROM places WHERE id=?", places[i].id)!.data),
        );
      transaction(() => {
        db.prepare(
          "INSERT INTO discovery_searches VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET place_ids=excluded.place_ids,created_at=excluded.created_at,truncated=excluded.truncated",
        ).run(
          key,
          JSON.stringify(places.map((p) => p.id)),
          Date.now(),
          +(entries.length > 1000),
        );
        db.prepare("DELETE FROM discovery_searches WHERE created_at<?").run(
          Date.now() - 10 * 60000,
        );
      });
      const result = {
        places,
        truncated: entries.length > 1000,
        fetchedAt: Date.now(),
      };
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, result);
      return result;
    } catch (e) {
      const stored = previouslyDiscovered(
        lat,
        lng,
        input.radius,
        "Live discovery could not connect. Showing previously discovered places; details may have changed.",
      );
      if (stored) return stored;
      if (e instanceof Error && "status" in e) throw e;
      fail(
        503,
        "Restaurant discovery could not connect. Check your connection and try again.",
      );
    } finally {
      active = false;
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, task);
  return task;
}
