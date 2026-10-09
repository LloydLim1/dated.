import test from "node:test";
import assert from "node:assert/strict";
import {
  mapPriority,
  selectMapPins,
  pinDensity,
} from "../src/lib/map-hierarchy.mjs";
import { normalizeCinema } from "../src/lib/cinema-catalog.mjs";
const place = (id, x, y, extras = {}) => ({
  id,
  name: "Place " + id,
  category: "Restaurant",
  sample: false,
  lat: y,
  lng: x,
  reviewCount: 0,
  independentVisits: 0,
  rating: null,
  ...extras,
});
const choose = (ps, zoom = 12) =>
  selectMapPins(ps, {
    zoom,
    width: 1400,
    height: 1000,
    project: (p) => ({ x: p.lng, y: p.lat }),
  });
test("actual visitor evidence beats brand metadata and logos do not influence hierarchy", () => {
  const local = place("local", 300, 300, {
    independentVisits: 8,
    reviewCount: 6,
    rating: 4.8,
  });
  const branded = place("brand", 600, 300, { brandId: "Q1", logo: "/logo" });
  assert.ok(mapPriority(local) > mapPriority(branded));
  assert.equal(
    mapPriority(branded),
    mapPriority({ ...branded, logo: undefined }),
  );
  assert.equal(choose([branded, local])[0].place.id, "local");
});
test("wider views show fewer prominent pins and close-up views progressively admit more places", () => {
  const ps = Array.from({ length: 130 }, (_, i) =>
    place(String(i), 40 + (i % 9) * 145, 40 + Math.floor(i / 9) * 65, {
      independentVisits: i === 0 ? 20 : 0,
    }),
  );
  const wide = choose(ps, 11),
    near = choose(ps, 17);
  assert.equal(wide.length, pinDensity(11).limit);
  assert.ok(near.length > wide.length);
  assert.equal(wide[0].place.id, "0");
  assert.ok(wide.every((p) => near.some((n) => n.place.id === p.place.id)));
});
test("labels avoid collisions, viewport edges and controls, and never show samples or pending coordinates", () => {
  const ps = [
    place("popular", 400, 300, { independentVisits: 20 }),
    place("overlap", 420, 305),
    place("far", 800, 700),
    place("sample", 100, 100, { sample: true }),
    place("pending", 200, 200, {
      lat: null,
      lng: null,
      locationStatus: "address_only",
    }),
  ];
  const opts = {
    zoom: 17,
    width: 1000,
    height: 900,
    project: (p) => ({ x: p.lng, y: p.lat }),
    excluded: [{ left: 0, right: 370, top: 0, bottom: 900 }],
  };
  const pins = selectMapPins(ps, opts);
  assert.deepEqual(
    pins.map((p) => p.place.id),
    ["popular", "far"],
  );
  for (let i = 0; i < pins.length; i++)
    for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i].box,
        b = pins[j].box;
      assert.ok(
        a.right <= b.left ||
          b.right <= a.left ||
          a.bottom <= b.top ||
          b.bottom <= a.top,
      );
    }
  assert.deepEqual(
    selectMapPins([...ps].reverse(), opts).map((p) => p.place.id),
    pins.map((p) => p.place.id),
  );
});
test("cinemas use their own category, preserve identities and never inherit restaurant menus", () => {
  const p = normalizeCinema({
    type: "node",
    id: 25,
    lat: 14.55,
    lon: 121.02,
    tags: {
      amenity: "cinema",
      name: "Mapped Cinema",
      "addr:city": "Makati",
      "website:menu": "https://menu.cafeoasis.ph/",
    },
  });
  assert.equal(p.id, "osm-node-25");
  assert.equal(p.category, "Cinema");
  assert.equal(p.menuUrl, undefined);
  assert.equal(p.budgetKnown, false);
  assert.equal(
    normalizeCinema({
      type: "node",
      id: 26,
      tags: { amenity: "restaurant", name: "Other" },
    }),
    null,
  );
});
