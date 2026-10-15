import "server-only";
import { z } from "zod";
import { getPlaces } from "./read";
import { matchesDiscovery } from "@/lib/discovery-filters.mjs";

export const discoveryFilters = z.object({
  category: z
    .enum(["All places", "Café", "Restaurant", "Cinema", "Museum"])
    .default("All places"),
  city: z.string().max(100).default("Metro Manila"),
  query: z.string().max(200).default(""),
  budget: z.coerce.number().min(0).max(100000).default(0),
  budgetBasis: z.enum(["person", "total"]).default("person"),
  groupSize: z.coerce.number().int().min(1).max(20).default(1),
  occasion: z.string().max(100).default("Any occasion"),
  minRating: z.coerce.number().min(0).max(5).default(0),
  criterion: z.string().max(100).default(""),
  criterionMinimum: z.coerce.number().min(0).max(5).default(0),
  minReviews: z.coerce.number().int().min(1).max(100).default(1),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.1).max(100).optional(),
});
export function discoverMatchingPlaces(input: unknown) {
  const filters = discoveryFilters.parse(input);
  return getPlaces().filter((place) => matchesDiscovery(place, filters));
}
