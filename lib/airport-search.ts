import { cacheLife, cacheTag } from "next/cache";
import {
  AIRPORT_GUIDES_CACHE_TAG,
  AIRPORT_PROFILES_CACHE_TAG,
  getAllAirports,
  getAllHonestAirports,
} from "@/lib/airport-content";
import {
  defaultCollator,
  filterOptionsByQuery,
  locationOptions,
  mergeAirportsWithPriority,
  normalizeSearchValue,
  searchExamples,
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
    return defaultCollator.compare(a.name, b.name);
  });
}

interface IndexedAirport {
  entry: AirportSearchEntry;
  /** Accent-stripped lowercase match fields, precomputed once per index build. */
  iata: string;
  city: string;
  name: string;
  cityCountry: string;
}

interface AirportSearchIndex {
  airports: IndexedAirport[];
  cityOptions: SearchOption[];
  countryOptions: SearchOption[];
  /** Cities containing exactly one airport, so a city match can jump straight to it. */
  singleAirportCityEntries: Map<string, AirportSearchEntry>;
  examples: SearchExamples | null;
}

// "use cache" replays a serialized payload on every read, so anything derived
// from the entry list (normalized match fields, sorted option lists) would be
// recomputed per keystroke if it lived behind the same boundary. Memoize the
// derived index per server instance instead; the TTL is well inside the
// endpoint's CDN s-maxage, so effective freshness is unchanged.
const SEARCH_INDEX_TTL_MS = 60_000;

let searchIndex: { expiresAt: number; value: Promise<AirportSearchIndex> } | null = null;

function getAirportSearchIndex(): Promise<AirportSearchIndex> {
  if (searchIndex && searchIndex.expiresAt > Date.now()) {
    return searchIndex.value;
  }

  const next = {
    expiresAt: Date.now() + SEARCH_INDEX_TTL_MS,
    value: getAirportSearchEntries().then(buildSearchIndex),
  };
  searchIndex = next;
  next.value.catch(() => {
    if (searchIndex === next) {
      searchIndex = null;
    }
  });
  return next.value;
}

function buildSearchIndex(entries: AirportSearchEntry[]): AirportSearchIndex {
  const airportsPerCity = new Map<string, number>();
  for (const entry of entries) {
    airportsPerCity.set(entry.city, (airportsPerCity.get(entry.city) ?? 0) + 1);
  }

  const singleAirportCityEntries = new Map<string, AirportSearchEntry>();
  for (const entry of entries) {
    if (airportsPerCity.get(entry.city) === 1) {
      singleAirportCityEntries.set(entry.city, entry);
    }
  }

  return {
    airports: entries.map((entry) => ({
      entry,
      iata: normalizeSearchValue(entry.iata),
      city: normalizeSearchValue(entry.city),
      name: normalizeSearchValue(entry.name),
      cityCountry: normalizeSearchValue(`${entry.city} ${entry.country}`),
    })),
    cityOptions: locationOptions(entries, "city"),
    countryOptions: locationOptions(entries, "country"),
    singleAirportCityEntries,
    examples: searchExamples(entries),
  };
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
  const index = await getAirportSearchIndex();
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery && !location) {
    return { airports: [], cities: [], countries: [], examples: index.examples };
  }

  const scoped = location
    ? index.airports.filter((airport) => airport.entry[location.field] === location.value)
    : index.airports;

  // Rank buckets: exact IATA, city prefix, name substring, city+country
  // substring. Entries arrive score-sorted, so bucket order is final order.
  const ranked: [
    AirportSearchEntry[],
    AirportSearchEntry[],
    AirportSearchEntry[],
    AirportSearchEntry[],
  ] = [[], [], [], []];

  const cities: SearchOption[] = [];
  const singleAirportCities: AirportSearchEntry[] = [];
  let countries: SearchOption[] = [];

  if (normalizedQuery) {
    for (const airport of scoped) {
      if (airport.iata === normalizedQuery) ranked[0].push(airport.entry);
      else if (airport.city.startsWith(normalizedQuery)) ranked[1].push(airport.entry);
      else if (airport.name.includes(normalizedQuery)) ranked[2].push(airport.entry);
      else if (airport.cityCountry.includes(normalizedQuery)) ranked[3].push(airport.entry);
    }

    for (const option of filterOptionsByQuery(index.cityOptions, normalizedQuery).slice(0, 5)) {
      const only = index.singleAirportCityEntries.get(option.value);
      if (only) {
        singleAirportCities.push(only);
      } else {
        cities.push(option);
      }
    }
    countries = filterOptionsByQuery(index.countryOptions, normalizedQuery).slice(0, 5);
  }

  const filtered = normalizedQuery
    ? [...ranked[0], ...ranked[1], ...ranked[2], ...ranked[3]]
    : scoped.map((airport) => airport.entry);

  // An exact IATA hit is the strongest possible intent signal, so it outranks
  // the single-airport-city shortcut rows ("atl" must surface Atlanta before
  // the one airport in Atlantic, IA).
  const merged =
    normalizedQuery && !location
      ? mergeAirportsWithPriority([...ranked[0], ...singleAirportCities], filtered)
      : filtered;

  return {
    // Location drill-downs list more rows than a free-text lookup, but the
    // reference dataset makes some countries huge, so they still get capped.
    airports: location ? merged.slice(0, 50) : merged.slice(0, 8),
    cities,
    countries,
    examples: null,
  };
}
