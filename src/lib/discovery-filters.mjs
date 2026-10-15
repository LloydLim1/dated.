export function matchesDiscovery(place, filters = {}) {
  const category = filters.category || "All places";
  const city = filters.city || "Metro Manila";
  const query = String(filters.query || "")
    .trim()
    .toLowerCase();
  const budget = Number(filters.budget || 0);
  const group = Number(filters.groupSize || 1);
  const occasion = filters.occasion || "Any occasion";
  if (category !== "All places" && place.category !== category) return false;
  if (city !== "Metro Manila" && city !== "Near me" && place.city !== city)
    return false;
  if (
    query &&
    !`${place.name} ${place.city} ${place.neighborhood} ${place.category} ${(place.tags || []).join(" ")}`
      .toLowerCase()
      .includes(query)
  )
    return false;
  if (
    budget &&
    (place.budgetKnown === false ||
      !Number.isFinite(place.budget) ||
      place.budget * (filters.budgetBasis === "total" ? group : 1) > budget)
  )
    return false;
  if (occasion !== "Any occasion" && !(place.tags || []).includes(occasion))
    return false;
  const minimum = Number(filters.minRating || 0);
  if (
    minimum &&
    (place.rating == null ||
      place.rating < minimum ||
      Number(place.ratedReviewerCount || 0) < Number(filters.minReviews || 1))
  )
    return false;
  if (filters.criterion && Number(filters.criterionMinimum || 0)) {
    const aggregate = place.criteria?.[filters.criterion];
    if (
      !aggregate ||
      aggregate.average < Number(filters.criterionMinimum) ||
      aggregate.count < Number(filters.minReviews || 1)
    )
      return false;
  }
  const lat = Number(filters.lat),
    lng = Number(filters.lng);
  if (filters.radius || city === "Near me") {
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      filters.lat === undefined ||
      filters.lng === undefined ||
      place.lat == null ||
      place.lng == null
    )
      return false;
    const rad = (n) => (n * Math.PI) / 180;
    const dlat = rad(place.lat - lat),
      dlng = rad(place.lng - lng);
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(rad(lat)) * Math.cos(rad(place.lat)) * Math.sin(dlng / 2) ** 2;
    if (
      6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) >
      Number(filters.radius || 20)
    )
      return false;
  }
  return true;
}
