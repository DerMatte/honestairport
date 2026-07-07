import type { AirportSearchScope } from "@/lib/types";

export interface AirportSearchScopeConfig {
  value: AirportSearchScope;
  label: string;
  placeholder: string;
  empty: string;
  heading: string;
}

export const airportSearchScopes: AirportSearchScopeConfig[] = [
  {
    value: "all",
    label: "All",
    placeholder: "Search airports, cities, or countries…",
    empty: "No matching airports, cities, or countries.",
    heading: "Airports",
  },
  {
    value: "city",
    label: "City",
    placeholder: "Search or pick a city…",
    empty: "No matching cities found.",
    heading: "Cities",
  },
  {
    value: "country",
    label: "Country",
    placeholder: "Search or pick a country…",
    empty: "No matching countries found.",
    heading: "Countries",
  },
];

export interface SearchOption {
  value: string;
  label: string;
  description: string;
  searchValue: string;
}

export interface SearchableLocation {
  iata: string;
  slug: string;
  name: string;
  shortName?: string;
  city: string;
  country: string;
  score?: number;
}

export function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function searchScopeConfig(scope: AirportSearchScope): AirportSearchScopeConfig {
  return airportSearchScopes.find((item) => item.value === scope) ?? airportSearchScopes[0];
}

export function locationOptions(
  airports: SearchableLocation[],
  field: "city" | "country",
): SearchOption[] {
  const counts = new Map<string, number>();

  for (const airport of airports) {
    const value = airport[field];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({
      value,
      label: value,
      description: `${count} airport${count === 1 ? "" : "s"}`,
      searchValue: normalizeSearchValue(value),
    }));
}

export function airportSearchOptions(airports: SearchableLocation[]): SearchOption[] {
  return airports.map((airport) => ({
    value: airport.iata,
    label: airport.shortName ?? airport.name,
    description: `${airport.iata} · ${airport.city}, ${airport.country}`,
    searchValue: normalizeSearchValue(
      [
        airport.name,
        airport.shortName,
        airport.iata,
        airport.city,
        airport.country,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  }));
}

export function searchOptionsForScope(
  airports: SearchableLocation[],
  scope: AirportSearchScope,
): SearchOption[] {
  if (scope === "city" || scope === "country") {
    return locationOptions(airports, scope);
  }

  return airportSearchOptions(airports);
}

export function matchAirportRank(airport: SearchableLocation, query: string): number {
  if (normalizeSearchValue(airport.iata) === query) return 0;
  if (normalizeSearchValue(airport.city).startsWith(query)) return 1;
  if (normalizeSearchValue(airport.name).includes(query)) return 2;
  if (normalizeSearchValue(`${airport.city} ${airport.country}`).includes(query)) return 3;
  return -1;
}

export function filterAirportsByQuery(
  airports: SearchableLocation[],
  query: string,
  scope: AirportSearchScope,
): SearchableLocation[] {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return airports;

  if (scope === "city") {
    return airports.filter((airport) =>
      normalizeSearchValue(airport.city).includes(normalizedQuery),
    );
  }

  if (scope === "country") {
    return airports.filter((airport) =>
      normalizeSearchValue(airport.country).includes(normalizedQuery),
    );
  }

  return airports
    .map((airport) => ({ airport, rank: matchAirportRank(airport, normalizedQuery) }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map(({ airport }) => airport);
}

export function filterOptionsByQuery(options: SearchOption[], query: string): SearchOption[] {
  const normalizedQuery = normalizeSearchValue(query);
  if (!normalizedQuery) return options;

  return options.filter((option) => option.searchValue.includes(normalizedQuery));
}

function optionCount(option: SearchOption): number {
  const match = option.description.match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

export function splitCityMatchesByAirportCount(
  airports: SearchableLocation[],
  cityOptions: SearchOption[],
): { cities: SearchOption[]; singleAirportCities: SearchableLocation[] } {
  const cities: SearchOption[] = [];
  const singleAirportCities: SearchableLocation[] = [];

  for (const option of cityOptions) {
    if (optionCount(option) === 1) {
      const airport = airports.find((item) => item.city === option.value);
      if (airport) singleAirportCities.push(airport);
      continue;
    }
    cities.push(option);
  }

  return { cities, singleAirportCities };
}

export function mergeAirportsWithPriority(
  primary: SearchableLocation[],
  secondary: SearchableLocation[],
): SearchableLocation[] {
  const seen = new Set<string>();
  const merged: SearchableLocation[] = [];

  for (const airport of [...primary, ...secondary]) {
    if (seen.has(airport.iata)) continue;
    seen.add(airport.iata);
    merged.push(airport);
  }

  return merged;
}

export interface SearchExamples {
  airport: SearchableLocation;
  city: SearchOption;
  country: SearchOption;
}

export function searchExamples(airports: SearchableLocation[]): SearchExamples | null {
  if (airports.length === 0) return null;

  const airport = [...airports].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const cities = locationOptions(airports, "city");
  const countries = locationOptions(airports, "country");

  if (!airport || cities.length === 0 || countries.length === 0) return null;

  const city = cities.reduce((best, current) =>
    optionCount(current) > optionCount(best) ? current : best,
  );
  const country = countries.reduce((best, current) =>
    optionCount(current) > optionCount(best) ? current : best,
  );

  return { airport, city, country };
}
