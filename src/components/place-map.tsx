"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import {
  Search,
  X,
  Navigation,
  RotateCw,
  Coffee,
  Utensils,
  Landmark,
  Film,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Star,
  MapPin,
  Layers,
  Grid2X2,
  SlidersHorizontal,
  LoaderCircle,
} from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Place } from "@/lib/types";
import { datedMapStyle } from "@/lib/map-theme";
import {
  rankedMapPlaces,
  selectMapPins,
  mapPriority,
} from "@/lib/map-hierarchy.mjs";
maplibregl.setWorkerUrl(
  new URL(
    "maplibre-gl/dist/maplibre-gl-worker.mjs",
    import.meta.url,
  ).toString(),
);
const categories = [
  { name: "All places", label: "All", icon: Grid2X2 },
  { name: "Restaurant", label: "Restaurants", icon: Utensils },
  { name: "Café", label: "Cafés", icon: Coffee },
  { name: "Museum", label: "Museums", icon: Landmark },
  { name: "Cinema", label: "Cinemas", icon: Film },
];
const icons: Record<string, string> = {
  Restaurant:
    '<path d="M4 3v7m3-7v7m3-7v7M4 7h6M7 10v11M17 3v18m0-18c-4 3-4 9 0 9"/>',
  Café: '<path d="M4 7h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7Zm12 1h2a3 3 0 0 1 0 6h-2M3 22h15M7 2v2m5-2v2"/>',
  Museum: '<path d="m3 8 9-5 9 5H3Zm2 3v8m7-8v8m7-8v8M2 22h20"/>',
  Cinema:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18m10-18v18M3 8h4m10 0h4M3 16h4m10 0h4"/>',
};
export default function PlaceMap({
  places,
  onSelect,
  onDiscover,
  center,
  category,
  onCategory,
  query,
  onQuery,
  onFilters,
  onGrid,
  onSave,
  savedIds,
  catalogCount,
}: {
  places: Place[];
  onSelect: (p: Place) => void;
  onDiscover: (p: Place[]) => void;
  center?: { lat: number; lng: number } | null;
  category: string;
  onCategory: (c: string) => void;
  query: string;
  onQuery: (q: string) => void;
  onFilters: () => void;
  onGrid: () => void;
  onSave: (p: Place) => void;
  savedIds: Set<string>;
  catalogCount?: number;
}) {
  const el = useRef<HTMLDivElement>(null),
    mapRef = useRef<maplibregl.Map | null>(null);
  const dataRef = useRef(places),
    callbacks = useRef({ onSelect, onDiscover }),
    drawRef = useRef<() => void>(() => {}),
    searchRef = useRef<(force?: boolean) => void>(() => {}),
    focusRef = useRef<(p: Place) => void>(() => {});
  const initialCenter = useRef(center || { lat: 14.557, lng: 121.024 });
  const [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [failed, setFailed] = useState(false),
    [zoom, setZoom] = useState(12.2),
    [visible, setVisible] = useState<Place[]>([]),
    [pinCount, setPinCount] = useState(0),
    [range, setRange] = useState(""),
    [panelOpen, setPanelOpen] = useState(true),
    [selectedId, setSelectedId] = useState("");
  const selectedRef = useRef(""),
    panelRef = useRef(true);
  useEffect(() => {
    callbacks.current = { onSelect, onDiscover };
    dataRef.current = places;
    drawRef.current();
  }, [places, onSelect, onDiscover]);
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined,
      running = false,
      lastKey = "",
      controller: AbortController | undefined;
    const markers = new Map<string, maplibregl.Marker>();
    let map: maplibregl.Map | null = null;
    const redraw = () => {
      if (!map || disposed) return;
      const bounds = map.getBounds(),
        canvas = map.getContainer(),
        width = canvas.clientWidth,
        height = canvas.clientHeight;
      const inView = rankedMapPlaces(
        dataRef.current.filter(
          (p) =>
            p.lat !== null && p.lng !== null && bounds.contains([p.lng, p.lat]),
        ),
      );
      setVisible(inView);
      setZoom(map.getZoom());
      const c = map.getCenter(),
        edge = map.unproject([width / 2, height]);
      setRange(
        (c.distanceTo(edge) / 1000).toFixed(c.distanceTo(edge) < 1000 ? 1 : 0) +
          " km",
      );
      const mobile = width < 680;
      const excluded = mobile
        ? [
            { left: 0, right: width, top: 0, bottom: 114 },
            { left: width - 58, right: width, top: 110, bottom: 220 },
            {
              left: width - 58,
              right: width,
              top: height - 322,
              bottom: height,
            },
            ...(panelRef.current
              ? [{ left: 0, right: width, top: height - 285, bottom: height }]
              : []),
          ]
        : [
            {
              left: 0,
              right: panelRef.current ? 370 : 58,
              top: 0,
              bottom: panelRef.current ? height : 60,
            },
            { left: width - 50, right: width, top: 0, bottom: 160 },
            {
              left: width - 58,
              right: width,
              top: height - 120,
              bottom: height,
            },
            {
              left: panelRef.current ? 370 : 48,
              right: panelRef.current ? 710 : 388,
              top: height - 43,
              bottom: height,
            },
            {
              left: panelRef.current ? 370 : 48,
              right: width,
              top: 0,
              bottom: 74,
            },
          ];
      const pins = selectMapPins(inView, {
        zoom: map.getZoom(),
        width,
        height,
        project: (p: Place) => map!.project([p.lng!, p.lat!]),
        excluded,
        selectedId: selectedRef.current,
      });
      const shown = new Set(pins.map((pin) => pin.place.id));
      for (const [id, marker] of markers)
        if (!shown.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      for (const { place: p } of pins) {
        let marker = markers.get(p.id);
        if (marker && marker.getElement().dataset.logo !== (p.logo || "")) {
          marker.remove();
          markers.delete(p.id);
          marker = undefined;
        }
        if (!marker) {
          const button = document.createElement("button");
          button.type = "button";
          button.className =
            "map-poi " + p.category.toLowerCase().replace("é", "e");
          button.dataset.placeId = p.id;
          button.dataset.logo = p.logo || "";
          button.setAttribute("aria-label", "Open " + p.name);
          button.title = p.name;
          const icon = document.createElement("span");
          icon.className = "poi-icon";
          icon.innerHTML = `<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[p.category] || icons.Restaurant}</svg>`;
          if (p.logo) {
            const img = document.createElement("img");
            img.src = p.logo;
            img.alt = "";
            img.onload = () => icon.classList.add("has-logo");
            img.onerror = () => img.remove();
            icon.appendChild(img);
          }
          const name = document.createElement("span");
          name.className = "poi-name";
          name.textContent = p.name;
          button.append(icon, name);
          button.addEventListener("click", () => {
            selectedRef.current = p.id;
            setSelectedId(p.id);
            callbacks.current.onSelect(
              dataRef.current.find((entry) => entry.id === p.id) || p,
            );
          });
          marker = new maplibregl.Marker({
            element: button,
            anchor: "left",
            offset: [-13, 0],
          })
            .setLngLat([p.lng!, p.lat!])
            .addTo(map);
          markers.set(p.id, marker);
        }
        marker
          .getElement()
          .classList.toggle("selected", p.id === selectedRef.current);
      }
      setPinCount(pins.length);
    };
    const search = async (force = false) => {
      if (running) return;
      const c = map?.getCenter() || initialCenter.current;
      const key = `${c.lat.toFixed(3)}:${c.lng.toFixed(3)}`;
      if (!force && key === lastKey) return;
      if (
        !force &&
        map &&
        map.getZoom() < 13 &&
        dataRef.current.some((p) => p.catalogRegion === "Metro Manila")
      ) {
        setBusy(false);
        redraw();
        return;
      }
      running = true;
      setBusy(true);
      setError("");
      controller = new AbortController();
      try {
        const response = await fetch(
          `/api/places/nearby?lat=${c.lat.toFixed(3)}&lng=${c.lng.toFixed(3)}&radius=1500`,
          { signal: controller.signal },
        );
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Please try this area again.");
        if (disposed) return;
        lastKey = result.stale ? "" : key;
        callbacks.current.onDiscover(result.places);
        if (result.warning) setError(result.warning);
        redraw();
      } catch (e) {
        if (!disposed && !(e instanceof Error && e.name === "AbortError"))
          setError((e as Error).message);
      } finally {
        running = false;
        if (!disposed) {
          setBusy(false);
          const now = map?.getCenter();
          if (now && `${now.lat.toFixed(3)}:${now.lng.toFixed(3)}` !== key)
            timer = setTimeout(() => void search(), 800);
        }
      }
    };
    drawRef.current = redraw;
    searchRef.current = (force) => void search(force);
    focusRef.current = (p) => {
      selectedRef.current = p.id;
      setSelectedId(p.id);
      if (p.lat !== null && p.lng !== null)
        map?.easeTo({
          center: [p.lng, p.lat],
          zoom: Math.max(map.getZoom(), 16),
          padding: { left: map.getContainer().clientWidth < 680 ? 0 : 180 },
          duration: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? 0
            : 550,
        });
      callbacks.current.onSelect(p);
    };
    try {
      if (!el.current) return;
      map = new maplibregl.Map({
        container: el.current,
        center: [initialCenter.current.lng, initialCenter.current.lat],
        zoom: 12.2,
        attributionControl: { compact: true },
        maxZoom: 20,
      });
      mapRef.current = map;
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: true }),
        "top-right",
      );
      map.addControl(
        new maplibregl.ScaleControl({ unit: "metric", maxWidth: 110 }),
        "bottom-right",
      );
      map.on("load", () => {
        if (disposed) return;
        setFailed(false);
        redraw();
      });
      map.on("error", () => {
        if (!disposed) setFailed(true);
      });
      map.on("moveend", () => {
        redraw();
        clearTimeout(timer);
        timer = setTimeout(() => void search(), 800);
      });
      map.on("resize", redraw);
      const customStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL;
      const tokens = getComputedStyle(el.current);
      map.setStyle(customStyle || "https://tiles.openfreemap.org/styles/positron", {
        // An explicitly configured provider style keeps its own visual direction.
        transformStyle: customStyle
          ? undefined
          : (_previous, next) => datedMapStyle(next, tokens),
      });
    } catch {
      queueMicrotask(() => setFailed(true));
    }
    void search();
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timer);
      for (const marker of markers.values()) marker.remove();
      map?.remove();
      mapRef.current = null;
      drawRef.current = () => {};
    };
  }, []);
  const centerLat = center?.lat,
    centerLng = center?.lng;
  useEffect(() => {
    if (centerLat !== undefined && centerLng !== undefined)
      mapRef.current?.easeTo({
        center: [centerLng, centerLat],
        zoom: 13.5,
        duration: 500,
      });
  }, [centerLat, centerLng]);
  const togglePanel = () => {
    panelRef.current = !panelRef.current;
    setPanelOpen(panelRef.current);
    drawRef.current();
  };
  const locate = () => {
    if (!navigator.geolocation) {
      setError(
        "Your browser does not support location. Move the map to your area.",
      );
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        initialCenter.current = { lat: coords.latitude, lng: coords.longitude };
        mapRef.current?.easeTo({
          center: [coords.longitude, coords.latitude],
          zoom: 15,
        });
        setBusy(false);
        searchRef.current(true);
      },
      () => {
        setBusy(false);
        setError(
          "Location access was unavailable. You can move the map to your area.",
        );
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };
  const searchResults = query
    ? places
        .filter((p) => !p.sample)
        .sort(
          (a, b) => mapPriority(b) - mapPriority(a) || a.id.localeCompare(b.id),
        )
    : visible;
  const list = searchResults.slice(0, 40);
  return (
    <section
      className={
        "map-wrap discovery-map map-workspace " +
        (panelOpen ? "panel-open" : "panel-closed")
      }
      aria-label="Explore the map"
      data-zoom={zoom.toFixed(2)}
    >
      <div
        ref={el}
        className="map-canvas"
        aria-label="Map of restaurants, cafés, museums and cinemas. Move or zoom to reveal places."
      />
      <div className="map-search">
        <Search size={20} />
        <input
          aria-label="Search places on the map"
          placeholder="Search Dated places"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && list[0]) focusRef.current(list[0]);
          }}
        />
        {query && (
          <button aria-label="Clear map search" onClick={() => onQuery("")}>
            <X size={18} />
          </button>
        )}
        <button aria-label="Open grid view" onClick={onGrid}>
          <Grid2X2 size={19} />
        </button>
      </div>
      <aside className="map-results-panel" aria-label="Map search and results">
        <div className="map-panel-heading">
          <h1>{query ? "Search results" : "Explore this area"}</h1>
          <button aria-label="Map filters" onClick={onFilters}>
            <SlidersHorizontal size={18} />
          </button>
        </div>
        <p className="map-result-status" role="status">
          {busy ? (
            <>
              <LoaderCircle size={14} className="spin" /> Finding places nearby…
            </>
          ) : (
            <>
              {searchResults.length.toLocaleString()}{" "}
              {query ? "matching places" : "places in view"} · {pinCount} labels
            </>
          )}
        </p>
        <p className="map-hierarchy-note">
          {zoom < 13
            ? "Prominent places first. Zoom in for local discoveries."
            : zoom < 15
              ? "Neighborhood places. Zoom in to see more."
              : "Local detail. Choose a place to explore."}
        </p>
        <div className="map-results-list">
          {list.map((p) => {
            const Icon =
              categories.find((c) => c.name === p.category)?.icon || MapPin;
            return (
              <article
                key={p.id}
                className={
                  "map-result " + (selectedId === p.id ? "selected" : "")
                }
              >
                <button
                  className="map-result-open"
                  aria-label={"Explore " + p.name}
                  onClick={() => focusRef.current(p)}
                >
                  <div className="map-result-copy">
                    <h2>{p.name}</h2>
                    <p>
                      {p.rating ? (
                        <>
                          <Star size={12} fill="currentColor" />{" "}
                          {p.rating.toFixed(1)} · {p.reviewCount} reviews
                        </>
                      ) : (
                        "No visitor ratings yet"
                      )}
                    </p>
                    <small>
                      {p.category} · {p.city}
                    </small>
                    <span>
                      {p.budgetKnown === false
                        ? "Prices not listed"
                        : "Estimated ₱" + p.budget + " / person"}
                    </span>
                  </div>
                  <span
                    className={
                      "map-result-art " +
                      p.category.toLowerCase().replace("é", "e")
                    }
                  >
                    <Icon size={26} aria-hidden="true" />
                    {p.logo && (
                      <img
                        src={p.logo}
                        alt={p.name + " logo"}
                        onError={(e) => {
                          e.currentTarget.hidden = true;
                        }}
                      />
                    )}
                  </span>
                </button>
                <button
                  className="map-result-save"
                  aria-label={
                    (savedIds.has(p.id) ? "Manage saved " : "Save ") + p.name
                  }
                  onClick={() => onSave(p)}
                >
                  <Bookmark
                    size={16}
                    fill={savedIds.has(p.id) ? "currentColor" : "none"}
                  />
                </button>
              </article>
            );
          })}
          {!busy && !list.length && (
            <div className="map-results-empty">
              <MapPin size={28} />
              <h2>No matching places in view</h2>
              <p>Move the map, zoom out or choose another category.</p>
              {query && (
                <button className="text-button" onClick={() => onQuery("")}>
                  Clear search
                </button>
              )}
            </div>
          )}
        </div>
        <div className="map-panel-footer">
          {catalogCount
            ? catalogCount.toLocaleString() +
              " mapped food places · Metro Manila"
            : "OpenStreetMap discovery"}
          <small>Ranked by Dated visits, reviews and mapped landmarks.</small>
        </div>
      </aside>
      <button
        className="map-panel-toggle"
        aria-label={panelOpen ? "Hide map results" : "Show map results"}
        aria-expanded={panelOpen}
        onClick={togglePanel}
      >
        {panelOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>
      <div
        className="map-category-controls"
        role="group"
        aria-label="Map place categories"
      >
        {categories.map((c) => (
          <button
            key={c.name}
            className={category === c.name ? "selected" : ""}
            aria-pressed={category === c.name}
            onClick={() => onCategory(c.name)}
          >
            <c.icon size={16} />
            {c.label}
          </button>
        ))}
      </div>
      <button
        className="map-locate-control"
        aria-label="Near me"
        title="Find my location"
        onClick={locate}
      >
        <Navigation size={19} />
      </button>
      <div className="map-zoom-guide">
        <Layers size={15} />
        {range && <span>About {range} to view edge</span>}
        <span>
          {zoom < 13
            ? "City view"
            : zoom < 15
              ? "Neighborhood view"
              : "Street view"}
        </span>
      </div>
      {error && (
        <div className="discovery-error" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => searchRef.current(true)}
          >
            <RotateCw size={15} />
            Retry this area
          </button>
        </div>
      )}
      {failed && (
        <p className="map-notice">
          Some map tiles could not load. Place search and results remain
          available.
        </p>
      )}
    </section>
  );
}
