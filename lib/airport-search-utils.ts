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

/** Reused for sorting; constructing a collator per compare is ~10x slower. */
export const defaultCollator = new Intl.Collator();

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
    .sort(([a], [b]) => defaultCollator.compare(a, b))
    .map(([value, count]) => ({
      value,
      label: value,
      description: `${count} airport${count === 1 ? "" : "s"}`,
      searchValue: normalizeSearchValue(value),
    }));
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
