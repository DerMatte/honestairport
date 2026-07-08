/**
 * Google Maps rating domain logic: types and raw (uncached) Postgres access.
 * Next-free on purpose — the ratings sync script runs it directly via tsx,
 * mirroring the split between `lib/airport-images.ts` and
 * `lib/airport-content.ts`.
 *
 * App code should read through `getAirportGoogleRating` in
 * `lib/airport-content.ts`, which wraps these reads in Next's data cache.
 */
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "./db";
import { airportGoogleRatings, type AirportGoogleRatingRow } from "./db/schema";

export interface AirportGoogleRating {
  placeName: string;
  rating: number;
  reviewCount: number;
  fetchedAt: string;
}

export function rowToAirportGoogleRating(row: AirportGoogleRatingRow): AirportGoogleRating {
  return {
    placeName: row.placeName,
    rating: row.rating,
    reviewCount: row.reviewCount,
    // `unstable_cache` JSON-serializes rows, so on cache hits `fetchedAt`
    // arrives as an ISO string rather than a Date.
    fetchedAt: new Date(row.fetchedAt).toISOString(),
  };
}

export async function fetchAirportGoogleRatingRow(
  iata: string,
): Promise<AirportGoogleRatingRow | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const [row] = await getDb()
    .select()
    .from(airportGoogleRatings)
    .where(eq(airportGoogleRatings.iata, iata.toUpperCase()))
    .limit(1);

  return row ?? null;
}

export async function fetchAllAirportGoogleRatingRows(): Promise<AirportGoogleRatingRow[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  return getDb().select().from(airportGoogleRatings);
}

export interface NewAirportGoogleRating {
  placeName: string;
  rating: number;
  reviewCount: number;
  raw?: Record<string, unknown>;
}

export async function upsertAirportGoogleRating(
  iata: string,
  values: NewAirportGoogleRating,
): Promise<void> {
  const normalizedIata = iata.toUpperCase();

  await getDb()
    .insert(airportGoogleRatings)
    .values({
      iata: normalizedIata,
      placeName: values.placeName,
      rating: values.rating,
      reviewCount: values.reviewCount,
      raw: values.raw ?? null,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: airportGoogleRatings.iata,
      set: {
        placeName: values.placeName,
        rating: values.rating,
        reviewCount: values.reviewCount,
        raw: values.raw ?? null,
        fetchedAt: new Date(),
      },
    });
}
