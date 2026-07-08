import { cacheLife, cacheTag } from "next/cache";
import {
  AIRPORT_GUIDES_CACHE_TAG,
  AIRPORT_PROFILES_CACHE_TAG,
  getAllAirports,
  getAllHonestAirports,
} from "@/lib/airport-content";
import { getAllAirportRecords } from "@/lib/airports";

export interface AirportSearchEntry {
  slug: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  /** Airportist Score, only present for fully scored airports. */
  score?: number;
}

/**
 * Merges the scored MVP airports with every markdown guide so site-wide
 * search covers all airports, not just the seeded ten.
 */
export async function getAirportSearchEntries(): Promise<AirportSearchEntry[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 60 * 60 * 24 });
  cacheTag(AIRPORT_GUIDES_CACHE_TAG);
  cacheTag(AIRPORT_PROFILES_CACHE_TAG);

  const [scored, guides] = await Promise.all([getAllHonestAirports(), getAllAirports()]);

  const entries = new Map<string, AirportSearchEntry>();

  for (const guide of guides) {
    const slug = guide.iata.toLowerCase();
    entries.set(slug, {
      slug,
      iata: guide.iata,
      name: guide.name,
      city: guide.city,
      country: guide.country,
    });
  }

  for (const airport of scored) {
    entries.set(airport.slug, {
      slug: airport.slug,
      iata: airport.iata,
      name: airport.name,
      city: airport.city,
      country: airport.country,
      score: airport.airportistScore,
    });
  }

  // Worldwide reference airports from lib/airports.json — guides are generated on
  // first visit and then served from Postgres like every other airport.
  for (const record of getAllAirportRecords()) {
    const slug = record.iata_code.toLowerCase();
    if (entries.has(slug)) {
      continue;
    }

    entries.set(slug, {
      slug,
      iata: record.iata_code,
      name: record.name,
      city: record.city_name,
      country: record.iata_country_code,
    });
  }

  return [...entries.values()].sort((a, b) => {
    if (a.score !== undefined || b.score !== undefined) {
      return (b.score ?? 0) - (a.score ?? 0);
    }
    return a.name.localeCompare(b.name);
  });
}
