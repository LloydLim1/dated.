import type { Outing, Place } from "./types";
export type ItinerarySettings = {
  title: string;
  intro: string;
  format: "timeline" | "compact";
  theme: "forest" | "rose" | "slate";
  showDate: boolean;
  showAddress: boolean;
  showBudget: boolean;
  stops: {
    placeId: string;
    time: string;
    minutes: number;
    note: string;
    budget: number | null;
  }[];
};
export type ItineraryDocument = Omit<ItinerarySettings, "stops"> & {
  date: string;
  stops: (ItinerarySettings["stops"][number] & {
    name: string;
    category: string;
    address: string;
    city: string;
    lat: number | null;
    lng: number | null;
  })[];
};
export function defaultItinerary(outing: Outing): ItinerarySettings {
  return {
    title: outing.title,
    intro: "",
    format: "timeline",
    theme: "forest",
    showDate: true,
    showAddress: true,
    showBudget: false,
    stops: outing.stops.map((placeId) => ({
      placeId,
      time: "",
      minutes: 60,
      note: "",
      budget: null,
    })),
  };
}
export function itineraryDocument(
  settings: ItinerarySettings,
  date: string,
  places: Place[],
): ItineraryDocument {
  return {
    ...settings,
    date: settings.showDate ? date : "",
    stops: settings.stops.map((stop) => {
      const place = places.find((p) => p.id === stop.placeId);
      return {
        ...stop,
        budget: settings.showBudget ? stop.budget : null,
        name: place?.name || "Place unavailable",
        category: place?.category || "Place",
        address: settings.showAddress ? place?.address || "" : "",
        city: place?.city || "",
        lat: place?.lat ?? null,
        lng: place?.lng ?? null,
      };
    }),
  };
}
export const itineraryDate = (date: string) =>
  new Date(date + "T12:00:00+08:00").toLocaleDateString("en-PH", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
export function itineraryText(doc: ItineraryDocument) {
  return [
    doc.title,
    doc.showDate ? itineraryDate(doc.date) : "",
    doc.intro,
    ...doc.stops.map((s, i) =>
      [
        `${i + 1}. ${s.time ? s.time + " · " : ""}${s.name}`,
        s.city,
        s.address,
        s.note,
        doc.showBudget && s.budget !== null
          ? `Planned budget: ₱${s.budget}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    "Made with Dated",
  ]
    .filter(Boolean)
    .join("\n\n");
}
const calendarEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/[,;]/g, "\\$&");
export function itineraryCalendar(doc: ItineraryDocument) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").slice(0, 15);
  const events = doc.stops
    .filter((s) => s.time)
    .map((s, i) => {
      const start = new Date(`${doc.date}T${s.time}:00Z`);
      const end = new Date(start.getTime() + s.minutes * 60000);
      return [
        "BEGIN:VEVENT",
        `UID:${crypto.randomUUID()}@dated`,
        `DTSTAMP:${stamp(new Date())}Z`,
        `DTSTART;TZID=Asia/Manila:${stamp(start)}`,
        `DTEND;TZID=Asia/Manila:${stamp(end)}`,
        `SUMMARY:${calendarEscape(s.name)}`,
        `DESCRIPTION:${calendarEscape(s.note)}`,
        `LOCATION:${calendarEscape(s.address || s.city)}`,
        `SEQUENCE:${i}`,
        "END:VEVENT",
      ].join("\r\n");
    });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dated//Itinerary//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}
