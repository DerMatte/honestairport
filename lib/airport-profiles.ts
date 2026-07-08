/**
 * Editorial airport-profile domain logic: types, row<->domain conversion, and
 * raw (uncached) Postgres access for the Airportist Score / amenities / tips
 * dataset. This module is Next-free on purpose, mirroring `airport-guides.ts`
 * — scripts run it directly via tsx.
 *
 * App code should read through `lib/airport-content.ts`, which wraps these
 * reads in Next's data cache with revalidation tags.
 */
import { eq, sql } from "drizzle-orm";
import { fetchAirportGuideRow, fetchAllAirportGuideRows } from "./airport-guides";
import { getDb, isDatabaseConfigured } from "./db";
import {
  airportProfiles,
  airportReviews,
  type AirportGuideRow,
  type AirportProfileDisruption,
  type AirportProfileRow,
  type NewAirportProfileRow,
} from "./db/schema";
import type { Airport, Region } from "./types";

/** Everything `upsertAirportProfile` needs, minus the PK/timestamp columns. */
export type AirportProfileInput = Omit<NewAirportProfileRow, "iata" | "updatedAt">;

/**
 * ISO 3166-1 alpha-2 country code -> directory region. Derived deterministically
 * instead of asking an LLM, since it's used for filter grouping and needs to
 * stay internally consistent. Covers every country in `MAJOR_AIRPORTS_BY_RANK`
 * (see `lib/major-airports.ts`); extend this map before scoring an airport in
 * a country not yet listed here.
 */
const COUNTRY_CODE_TO_REGION: Readonly<Record<string, Region>> = {
  // North America
  US: "North America",
  CA: "North America",
  MX: "North America",
  // Europe
  GB: "Europe",
  FR: "Europe",
  NL: "Europe",
  DE: "Europe",
  ES: "Europe",
  IT: "Europe",
  CH: "Europe",
  AT: "Europe",
  DK: "Europe",
  SE: "Europe",
  IE: "Europe",
  GR: "Europe",
  PT: "Europe",
  BE: "Europe",
  PL: "Europe",
  CZ: "Europe",
  HU: "Europe",
  FI: "Europe",
  NO: "Europe",
  RU: "Europe",
  // Middle East
  AE: "Middle East",
  QA: "Middle East",
  SA: "Middle East",
  IL: "Middle East",
  TR: "Middle East",
  // Asia-Pacific
  JP: "Asia-Pacific",
  IN: "Asia-Pacific",
  CN: "Asia-Pacific",
  KR: "Asia-Pacific",
  SG: "Asia-Pacific",
  TH: "Asia-Pacific",
  MY: "Asia-Pacific",
  AU: "Asia-Pacific",
  HK: "Asia-Pacific",
  ID: "Asia-Pacific",
  TW: "Asia-Pacific",
  // South America
  BR: "South America",
  CO: "South America",
  PE: "South America",
  CL: "South America",
  // Africa
  ZA: "Africa",
  EG: "Africa",
};

export function regionForCountryCode(countryCode: string): Region | null {
  return COUNTRY_CODE_TO_REGION[countryCode.trim().toUpperCase()] ?? null;
}

function deriveSlug(iata: string): string {
  return iata.toLowerCase();
}

function rowToAirport(
  profile: AirportProfileRow,
  guide: Pick<AirportGuideRow, "iata" | "name" | "city" | "country">,
  reviewCount: number,
): Airport {
  return {
    slug: deriveSlug(profile.iata),
    iata: profile.iata,
    icao: profile.icao,
    name: guide.name,
    shortName: profile.shortName,
    city: guide.city,
    country: guide.country,
    region: profile.region,
    coordinates: {
      latitude: profile.latitude,
      longitude: profile.longitude,
    },
    airportistScore: profile.airportistScore,
    scoreBreakdown: profile.scoreBreakdown,
    stats: profile.stats,
    summary: profile.summary,
    bestFor: profile.bestFor,
    watchOutFor: profile.watchOutFor,
    amenities: profile.amenities,
    tips: profile.tips,
    transport: profile.transport,
    disruption: {
      ...profile.disruption,
      lastUpdated: new Date(profile.disruption.lastUpdated),
    },
    reviewCount,
  };
}

// --- Uncached DB access ---------------------------------------------------------

export async function fetchAirportProfileRow(iata: string): Promise<AirportProfileRow | null> {
  if (!isDatabaseConfigured()) {
    console.warn("DATABASE_URL is not set; airport profiles are unavailable.");
    return null;
  }

  const rows = await getDb()
    .select()
    .from(airportProfiles)
    .where(eq(airportProfiles.iata, iata.toUpperCase()))
    .limit(1);

  return rows[0] ?? null;
}

export async function fetchAllAirportProfileRows(): Promise<AirportProfileRow[]> {
  if (!isDatabaseConfigured()) {
    console.warn("DATABASE_URL is not set; airport profiles are unavailable.");
    return [];
  }

  return getDb().select().from(airportProfiles);
}

/** Published review count per IATA, counting both editorial and community rows. */
async function fetchReviewCounts(): Promise<Map<string, number>> {
  if (!isDatabaseConfigured()) {
    return new Map();
  }

  const rows = await getDb()
    .select({
      iata: airportReviews.iata,
      count: sql<number>`count(*)::int`,
    })
    .from(airportReviews)
    .where(eq(airportReviews.status, "published"))
    .groupBy(airportReviews.iata);

  return new Map(rows.map((row) => [row.iata, row.count]));
}

async function fetchReviewCount(iata: string): Promise<number> {
  if (!isDatabaseConfigured()) {
    return 0;
  }

  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(airportReviews)
    .where(eq(airportReviews.iata, iata))
    .groupBy(airportReviews.iata);

  return row?.count ?? 0;
}

/** Composes the full `Airport` domain object from `airport_profiles` joined against `airport_guides`. */
export async function fetchAirportByIata(iata: string): Promise<Airport | null> {
  const normalized = iata.toUpperCase();
  const [profile, guide, reviewCount] = await Promise.all([
    fetchAirportProfileRow(normalized),
    fetchAirportGuideRow(normalized),
    fetchReviewCount(normalized),
  ]);

  if (!profile || !guide) {
    return null;
  }

  return rowToAirport(profile, guide, reviewCount);
}

export async function fetchAllAirports(): Promise<Airport[]> {
  const [profiles, guides, reviewCounts] = await Promise.all([
    fetchAllAirportProfileRows(),
    fetchAllAirportGuideRows(),
    fetchReviewCounts(),
  ]);

  const guidesByIata = new Map(guides.map((guide) => [guide.iata, guide]));

  return profiles.flatMap((profile) => {
    const guide = guidesByIata.get(profile.iata);
    if (!guide) {
      return [];
    }

    return [rowToAirport(profile, guide, reviewCounts.get(profile.iata) ?? 0)];
  });
}

export async function upsertAirportProfile(
  iata: string,
  input: AirportProfileInput,
): Promise<AirportProfileRow> {
  const normalized = iata.toUpperCase();
  const values: NewAirportProfileRow = {
    ...input,
    iata: normalized,
    updatedAt: new Date(),
  };

  const [row] = await getDb()
    .insert(airportProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: airportProfiles.iata,
      set: values,
    })
    .returning();

  return row;
}

export type { AirportProfileDisruption, AirportProfileRow };
