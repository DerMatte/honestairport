/**
 * Zod shapes for the Airportist Score profile (`airport_profiles` table),
 * shared between the on-demand web generator (`lib/generate-airport-profile.ts`)
 * and the curated grok pipeline (`scripts/generate-airport-grok.ts`) so every
 * generated airport gets a score with the same field limits, regardless of
 * which path produced it.
 */
import { z } from "zod";

export const nonEmpty = z.string().trim().min(1);

/** Some models emit "" for an optional field instead of leaving it out. */
export const optionalNonEmpty = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  nonEmpty.optional(),
);

/** Truncates instead of rejecting when a model returns a few extra items. */
export function boundedArray<T extends z.ZodTypeAny>(item: T, min: number, max: number) {
  return z
    .array(item)
    .min(min)
    .transform((arr) => arr.slice(0, max));
}

export const scoreSchema = z.number().min(0).max(10);

export const scoreBreakdownSchema = z.object({
  comfort: scoreSchema,
  navigation: scoreSchema,
  food: scoreSchema,
  transport: scoreSchema,
  disruptionResilience: scoreSchema,
});

export const statsSchema = z.object({
  annualPassengers: nonEmpty,
  terminals: nonEmpty,
  onTimePercentage: z.number().min(0).max(100),
  averageSecurityMinutes: z.number().min(0).max(180),
});

export const amenitySchema = z.object({
  label: nonEmpty,
  category: z.enum([
    "food",
    "lounge",
    "wifi",
    "family",
    "accessibility",
    "transport",
    "shopping",
    "sleep",
  ]),
  description: nonEmpty,
  quality: z.enum(["basic", "good", "excellent"]),
  isFeatured: z.boolean().optional(),
});

export const profileTipSchema = z.object({
  category: z.enum(["security", "food", "navigation", "layover", "transport", "family", "lounge"]),
  title: nonEmpty,
  summary: nonEmpty,
  details: nonEmpty,
  pro: optionalNonEmpty,
  con: optionalNonEmpty,
});

export const transportOptionSchema = z.object({
  type: z.enum(["train", "metro", "bus", "taxi", "rideshare", "parking"]),
  name: nonEmpty,
  summary: nonEmpty,
  timeToCity: nonEmpty,
  cost: nonEmpty,
  insiderTip: nonEmpty,
  bestFor: z.array(z.enum(["fastest", "cheapest", "luggage"])).optional(),
});

export const disruptionSchema = z.object({
  status: z.enum(["normal", "minor", "moderate", "severe"]),
  departureDelayMinutes: z.number().min(0).max(240),
  departureDelayPercent: z.number().min(0).max(100),
  arrivalDelayMinutes: z.number().min(0).max(240),
  arrivalDelayPercent: z.number().min(0).max(100),
  cancellationsPercent: z.number().min(0).max(100),
  alerts: boundedArray(nonEmpty, 0, 4).optional(),
});

export const regionSchema = z.enum([
  "North America",
  "Europe",
  "Asia-Pacific",
  "Middle East",
  "South America",
  "Africa",
]);

/**
 * Score-only slice of the Airportist Score profile — same field limits as the
 * curated `pnpm generate:airport:grok` pipeline, minus icao/latitude/longitude,
 * which always come from local reference data (`lib/airports.ts`) instead of
 * being asked of the model.
 */
export const airportScoreProfileSchema = z.object({
  shortName: nonEmpty.describe("Short recognizable name, e.g. 'London Heathrow'"),
  region: regionSchema,
  summary: nonEmpty.describe(
    "One evaluative sentence on the airport's overall traveler experience and key tradeoff",
  ),
  airportistScore: scoreSchema,
  scoreBreakdown: scoreBreakdownSchema,
  stats: statsSchema,
  bestFor: boundedArray(nonEmpty, 2, 4),
  watchOutFor: boundedArray(nonEmpty, 2, 4),
  amenities: boundedArray(amenitySchema, 4, 6),
  tips: boundedArray(profileTipSchema, 3, 5),
  transport: boundedArray(transportOptionSchema, 2, 4),
  disruption: disruptionSchema,
});

export type AirportScoreProfile = z.infer<typeof airportScoreProfileSchema>;
