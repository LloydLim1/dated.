import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, row, rows } from "./db";
import { requireUser, fail, id } from "./auth";
import {
  defaultItinerary,
  itineraryDocument,
  type ItineraryDocument,
  type ItinerarySettings,
} from "@/lib/itinerary";
import { placeById } from "./read";
const settingsSchema = z.object({
  title: z.string().trim().min(3).max(100),
  intro: z.string().trim().max(600),
  format: z.enum(["timeline", "compact"]),
  theme: z.enum(["forest", "rose", "slate"]),
  showDate: z.boolean(),
  showAddress: z.boolean(),
  showBudget: z.boolean(),
  stops: z
    .array(
      z.object({
        placeId: z.string().min(1).max(120),
        time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^$/),
        minutes: z.number().int().min(15).max(720),
        note: z.string().trim().max(400),
        budget: z.number().int().min(0).max(100000).nullable(),
      }),
    )
    .min(1)
    .max(10),
});
export function publicItinerary(token: string): ItineraryDocument | null {
  if (!/^[a-f0-9-]{36}$/.test(token)) return null;
  const saved = row(
    "SELECT published FROM itinerary_designs WHERE token=?",
    token,
  );
  return saved?.published ? JSON.parse(String(saved.published)) : null;
}
export function itineraryRequest(req: NextRequest, parts: string[]) {
  const json = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  if (
    req.method === "GET" &&
    parts[0] === "itineraries" &&
    parts.length === 2
  ) {
    const doc = publicItinerary(parts[1]);
    return doc
      ? json(doc)
      : json(
          {
            error: "This itinerary link is unavailable or has been turned off.",
          },
          404,
        );
  }
  if (parts[0] !== "outings" || parts[2] !== "itinerary" || parts.length !== 3)
    return null;
  const me = requireUser(req),
    outingId = parts[1];
  const owned = row(
    "SELECT * FROM outings WHERE id=? AND owner_id=?",
    outingId,
    me.id,
  );
  if (!owned)
    fail(404, "Only the outing host can design or share this itinerary.");
  const saved = row(
    "SELECT * FROM itinerary_designs WHERE outing_id=?",
    outingId,
  );
  if (req.method === "GET") {
    const stops = rows(
      "SELECT place_id FROM outing_stops WHERE outing_id=? ORDER BY position",
      outingId,
    ).map((r) => String(r.place_id));
    const defaults = defaultItinerary({
      title: String(owned.title),
      stops,
    } as Parameters<typeof defaultItinerary>[0]);
    const settings = saved
      ? (JSON.parse(String(saved.settings)) as ItinerarySettings)
      : defaults;
    settings.stops = settings.stops.filter((s) => stops.includes(s.placeId));
    if (!settings.stops.length) settings.stops = defaults.stops;
    return json({ settings, token: saved?.token || null });
  }
  if (req.method === "DELETE") {
    db.prepare(
      "UPDATE itinerary_designs SET token=NULL,published=NULL WHERE outing_id=?",
    ).run(outingId);
    return json({ token: null });
  }
  if (req.method !== "PATCH" && req.method !== "POST")
    return json({ error: "Method unavailable." }, 405);
  return (async () => {
    const body = z
      .object({ settings: settingsSchema, publish: z.boolean().default(false) })
      .parse(await req.json());
    const allowed = rows(
      "SELECT place_id FROM outing_stops WHERE outing_id=?",
      outingId,
    ).map((r) => String(r.place_id));
    if (
      new Set(body.settings.stops.map((s) => s.placeId)).size !==
        body.settings.stops.length ||
      body.settings.stops.some((s) => !allowed.includes(s.placeId))
    )
      fail(400, "Choose distinct stops from this outing.");
    const settings: ItinerarySettings = body.settings;
    const places = settings.stops
      .map((s) => placeById(s.placeId))
      .filter((p) => p !== null);
    if (places.length !== settings.stops.length)
      fail(400, "One of your places is no longer available.");
    const doc = itineraryDocument(settings, String(owned.date), places);
    // Public links are opt-in snapshots. Draft saves never modify an already shared plan.
    const token = body.publish ? saved?.token || id() : saved?.token || null;
    db.prepare(
      "INSERT INTO itinerary_designs(outing_id,settings,token,published,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(outing_id) DO UPDATE SET settings=excluded.settings,token=excluded.token,published=excluded.published,updated_at=excluded.updated_at",
    ).run(
      outingId,
      JSON.stringify(settings),
      token,
      body.publish ? JSON.stringify(doc) : saved?.published || null,
      Date.now(),
    );
    return json({ settings, token });
  })();
}
