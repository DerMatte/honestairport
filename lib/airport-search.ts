import { cacheLife, cacheTag } from "next/cache";
import {
  AIRPORT_GUIDES_CACHE_TAG,
  AIRPORT_PROFILES_CACHE_TAG,
  getAllAirports,
  getAllHonestAirports,
} from "@/lib/airport-content";
import {
  filterAirportsByQuery,
  filterOptionsByQuery,
  locationOptions,
  mergeAirportsWithPriority,
  searchExamples,
  splitCityMatchesByAirportCount,
  type SearchExamples,
  type SearchOption,
} from "@/lib/airport-search-utils";
import { getAllAirportRecords } from "@/lib/airports";

export interface AirportSearchEntry {
  slug: string;
  iata: string;
  name: string;
  shortName?: string;
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
      shortName: airport.shortName,
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

export interface AirportLocationFilter {
  field: "city" | "country";
  value: string;
}

export interface AirportSearchResults {
  airports: AirportSearchEntry[];
  cities: SearchOption[];
  countries: SearchOption[];
  /** Curated starting points, only populated for an empty, unfiltered query. */
  examples: SearchExamples | null;
}

/**
 * Server-side combobox search over the full airport list. The ~9k merged
 * entries stay on the server (cached above); clients send debounced queries
 * and get back only the handful of rows they render.
 */
export async function searchAirports(
  query: string,
  location?: AirportLocationFilter,
): Promise<AirportSearchResults> {
  const entries = await getAirportSearchEntries();
  const normalizedQuery = query.trim();

  if (!normalizedQuery && !location) {
    return { airports: [], cities: [], countries: [], examples: searchExamples(entries) };
  }

  const scoped = location
    ? entries.filter((entry) => entry[location.field] === location.value)
    : entries;

  const cityOptions = filterOptionsByQuery(locationOptions(entries, "city"), query).slice(0, 5);
  const { cities, singleAirportCities } = splitCityMatchesByAirportCount(entries, cityOptions);
  const countries = filterOptionsByQuery(locationOptions(entries, "country"), query).slice(0, 5);

  const filtered = filterAirportsByQuery(scoped, query, "all");
  const merged =
    normalizedQuery && !location
      ? mergeAirportsWithPriority(singleAirportCities, filtered)
      : filtered;

  return {
    // Location drill-downs list more rows than a free-text lookup, but the
    // reference dataset makes some countries huge, so they still get capped.
    airports: location ? merged.slice(0, 50) : merged.slice(0, 8),
    cities: normalizedQuery ? cities : [],
    countries: normalizedQuery ? countries : [],
    examples: null,
  };
}
