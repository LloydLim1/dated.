const valid = (p) =>
  !p.sample &&
  p.locationStatus !== "address_only" &&
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng);
export function mapPriority(p) {
  const visits = Math.max(0, Number(p.independentVisits) || 0),
    reviews = Math.max(0, Number(p.ratedReviewerCount ?? p.reviewCount) || 0);
  // Real Dated evidence outweighs map metadata. A logo is never a popularity signal.
  const community =
    Math.log1p(visits) * 80 +
    Math.log1p(reviews) * 24 +
    (reviews
      ? Math.max(0, Number(p.rating) || 0) * Math.min(reviews / 5, 1) * 4
      : 0);
  const landmark =
    p.category === "Museum"
      ? p.museumDirectoryUrl
        ? 12
        : p.brandId
          ? 9
          : 4
      : p.category === "Cinema"
        ? 9
        : 0;
  return community + landmark + (p.brandId ? 3 : 0) + (p.website ? 1 : 0);
}
export function rankedMapPlaces(places) {
  return places
    .filter(valid)
    .sort(
      (a, b) => mapPriority(b) - mapPriority(a) || a.id.localeCompare(b.id),
    );
}
export function pinDensity(zoom) {
  return zoom < 11.5
    ? { limit: 16, gap: 105 }
    : zoom < 13
      ? { limit: 30, gap: 82 }
      : zoom < 14.5
        ? { limit: 55, gap: 60 }
        : zoom < 16
          ? { limit: 100, gap: 42 }
          : { limit: 180, gap: 26 };
}
/**
 * @param {import('./types').Place[]} places
 * @param {{zoom:number,width:number,height:number,project:(p:import('./types').Place)=>{x:number,y:number},excluded?:{left:number,right:number,top:number,bottom:number}[],selectedId?:string}} options
 */
export function selectMapPins(
  places,
  {
    zoom,
    width,
    height,
    project,
    excluded = /** @type {{left:number;right:number;top:number;bottom:number}[]} */ ([]),
    selectedId,
  },
) {
  const density = pinDensity(zoom),
    occupied = [...excluded],
    pins = [];
  const ranked = rankedMapPlaces(places);
  if (selectedId)
    ranked.sort(
      (a, b) => Number(b.id === selectedId) - Number(a.id === selectedId),
    );
  const intersects = (a, b) =>
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top;
  for (const p of ranked) {
    const point = project(p),
      textWidth = Math.min(168, Math.max(55, p.name.length * 6.3)),
      box = {
        left: point.x - 14,
        right: point.x + textWidth + 27,
        top: point.y - 17,
        bottom: point.y + 17,
      };
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      box.left < 8 ||
      box.right > width - 8 ||
      box.top < 8 ||
      box.bottom > height - 8
    )
      continue;
    if (occupied.some((b) => intersects(box, b))) continue;
    if (
      pins.some(
        (pin) => Math.hypot(pin.x - point.x, pin.y - point.y) < density.gap,
      )
    )
      continue;
    pins.push({ place: p, x: point.x, y: point.y, box });
    occupied.push(box);
    if (pins.length >= density.limit) break;
  }
  return pins;
}
