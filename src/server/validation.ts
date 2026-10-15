import { z } from "zod";
import { CRITERIA } from "@/lib/types";
import { criteriaVersion } from "@/lib/review-criteria.mjs";
import { philippineDate } from "@/lib/philippine-date.mjs";
export const visibility = z.enum(["public", "followers", "private"]);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.")
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Choose a valid calendar date.",
  );
export const signup = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, or underscores."),
  name: z.string().trim().min(2).max(60),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
  adult: z.literal(true, { error: "The pilot is for adults 18 and over." }),
  terms: z.literal(true, {
    error: "Please accept the pilot terms and privacy notice.",
  }),
});
export const login = z.object({
  email: z.email().transform((s) => s.toLowerCase()),
  password: z.string().min(1).max(128),
});
export const reviewSchema = z.object({
  placeId: z.string().min(1),
  outingId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(100),
  body: z
    .string()
    .trim()
    .min(20, "Tell us a little more (at least 20 characters).")
    .max(3000),
  visitDate: date.refine(
    (v) => v <= philippineDate(),
    "Reviews are for visits that have already happened.",
  ),
  ratings: z.record(z.string(), z.number().int().min(1).max(5)),
  notApplicable: z.array(z.string().max(100)).max(5).default([]),
  rewardOptIn: z.boolean().default(false),
  spending: z
    .number()
    .int()
    .min(0)
    .max(100000)
    .nullable()
    .optional()
    .default(null),
  visibility,
  incentive: z.boolean(),
  media: z.array(z.string().uuid()).max(4),
  evidence: z.string().uuid().optional(),
});
export const postSchema = z.object({
  placeId: z.string().min(1),
  caption: z.string().trim().max(2200),
  visitDate: date.refine(
    (v) => v <= philippineDate(),
    "Choose today or a past visit.",
  ),
  visibility,
  media: z
    .array(z.string().uuid())
    .min(1, "Add at least one photo.")
    .max(10)
    .refine((v) => new Set(v).size === v.length, "Choose different photos."),
});
export const outingSchema = z.object({
  title: z.string().trim().min(3).max(100),
  date,
  visibility,
  notes: z.string().trim().max(2000),
  stops: z
    .array(z.string())
    .min(1)
    .max(10)
    .refine(
      (s) => new Set(s).size === s.length,
      "Each place can only appear once.",
    ),
  invitees: z.array(z.string().regex(/^[a-z0-9_]+$/)).max(10),
});
export function validCriteria(
  category: keyof typeof CRITERIA,
  ratings: Record<string, number>,
  notApplicable: string[] = [],
) {
  return criteriaVersion(category, ratings, notApplicable) > 0;
}
