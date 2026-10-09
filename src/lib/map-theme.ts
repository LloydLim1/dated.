import type { StyleSpecification } from "maplibre-gl";

// Read the same tokens used by Dated's controls and pins before the first map render.
export function datedMapStyle(
  style: StyleSpecification,
  tokens: CSSStyleDeclaration,
): StyleSpecification {
  const color = (name: string) => tokens.getPropertyValue(name).trim();
  const paper = color("--paper"),
    forest = color("--forest"),
    ink = color("--ink"),
    sage = color("--sage"),
    surface = color("--map-surface"),
    water = color("--map-water"),
    park = color("--map-park"),
    road = color("--map-road"),
    edge = color("--map-road-edge"),
    gold = color("--map-road-major"),
    label = color("--map-label");
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const id = layer.id;
      const paint: Record<string, string | number> = {};
      if (layer.type === "background") paint["background-color"] = paper;
      if (layer.type === "fill") {
        if (id === "water") paint["fill-color"] = water;
        else if (id === "park" || id === "landcover_wood")
          paint["fill-color"] = park;
        else if (id === "landuse_residential") paint["fill-color"] = sage;
        else if (id === "building") {
          paint["fill-color"] = color("--map-building");
          paint["fill-outline-color"] = edge;
        } else if (id.startsWith("landcover_")) paint["fill-color"] = paper;
        else if (id === "aeroway-area" || id === "road_area_pier")
          paint["fill-color"] = surface;
      }
      if (layer.type === "line") {
        if (id === "waterway") paint["line-color"] = water;
        else if (id.startsWith("boundary_")) paint["line-color"] = "#8ea497";
        else if (id.startsWith("railway"))
          paint["line-color"] = id.includes("dashline") ? surface : "#95aa9b";
        else if (/^(highway_|tunnel_|road_|aeroway-)/.test(id))
          paint["line-color"] = id.includes("casing")
            ? edge
            : id.includes("motorway") || id.includes("major_inner")
              ? gold
              : id.includes("subtle") || id.includes("path")
                ? edge
                : road;
      }
      if (layer.type === "symbol" && layer.layout?.["text-field"]) {
        paint["text-color"] = id.startsWith("water")
          ? "#486d65"
          : id.startsWith("label_")
            ? forest
            : label || ink;
        paint["text-halo-color"] = surface;
        paint["text-halo-width"] = 1.5;
      }
      return { ...layer, paint: { ...layer.paint, ...paint } };
    }),
  };
}
