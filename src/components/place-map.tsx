"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Place } from "@/lib/types";
export default function PlaceMap({
  places,
  onSelect,
}: {
  places: Place[];
  onSelect: (p: Place) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!el.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: el.current,
        style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            },
          },
          layers: [{ id: "base", type: "raster", source: "osm" }],
        },
        center: [121.012, 14.578],
        zoom: 11.6,
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      for (const p of places) {
        const button = document.createElement("button");
        button.className = "map-pin";
        button.textContent =
          p.category === "Café"
            ? "☕"
            : p.category === "Museum"
              ? "◈"
              : p.category === "Cinema"
                ? "▶"
                : "◌";
        button.setAttribute("aria-label", "Open " + p.name);
        button.addEventListener("click", () => onSelect(p));
        new maplibregl.Marker({ element: button })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
      }
      map.on("error", () => setFailed(true));
      if (places.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        places.forEach((p) => bounds.extend([p.lng, p.lat]));
        map.fitBounds(bounds, { padding: 70, maxZoom: 13, duration: 0 });
      }
    } catch {
      queueMicrotask(() => setFailed(true));
    }
    return () => map?.remove();
  }, [places, onSelect]);
  return (
    <div className="map-wrap">
      <div
        ref={el}
        className="map-canvas"
        aria-label="Map of sample places around Metro Manila"
      />
      {failed && (
        <p className="map-notice">
          Map tiles could not load. You can still browse all places in the list
          below.
        </p>
      )}
      <p className="map-caption">
        Sample locations for preview. Your location is never published.
      </p>
    </div>
  );
}
