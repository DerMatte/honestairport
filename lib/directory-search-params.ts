import {
  amenityCategories,
  disruptionStatuses,
  regions,
} from "@/lib/airport-utils";
import type {
  AirportFilters,
  AirportSearchScope,
  AirportSort,
  AmenityCategory,
  DisruptionStatus,
  Region,
} from "@/lib/types";

export const DEFAULT_DIRECTORY_FILTERS: AirportFilters = {
  query: "",
  searchScope: "all",
  minimumScore: 0,
  regions: [],
  amenities: [],
  disruptionStatuses: [],
  sort: "highest-score",
};

export const DIRECTORY_SEARCH_PARAM_KEYS = [
  "q",
  "scope",
  "sort",
  "score",
  "regions",
  "amenities",
  "disruption",
] as const;

type SearchParamReader = Pick<URLSearchParams, "get">;

function parseSearchScope(raw: string | null): AirportSearchScope {
  switch (raw) {
    case "all":
    case "city":
    case "country":
      return raw;
    default:
      return DEFAULT_DIRECTORY_FILTERS.searchScope;
  }
}

function parseSort(raw: string | null): AirportSort {
  switch (raw) {
    case "highest-score":
    case "most-reviewed":
    case "least-disruptions":
    case "newest-guides":
      return raw;
    default:
      return DEFAULT_DIRECTORY_FILTERS.sort;
  }
}

function parseCsvEnums<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T[] {
  if (!raw) return [];
  const allowedSet = new Set<string>(allowed);
  const seen = new Set<T>();
  const values: T[] = [];

  for (const part of raw.split(",")) {
    const value = part.trim();
    if (!value || !allowedSet.has(value)) continue;
    const typed = value as T;
    if (seen.has(typed)) continue;
    seen.add(typed);
    values.push(typed);
  }

  return allowed.filter((item) => seen.has(item));
}

function parseMinimumScore(raw: string | null): number {
  if (raw == null || raw.trim() === "") return 0;
  const score = Number(raw);
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(10, Math.round(score * 10) / 10);
}

function csv(values: readonly string[]): string {
  return values.join(",");
}

export function parseDirectorySearchParams(
  params: SearchParamReader,
): AirportFilters {
  const query = params.get("q") ?? "";
  const searchScope = parseSearchScope(params.get("scope"));

  return {
    query,
    searchScope: query.trim() ? searchScope : DEFAULT_DIRECTORY_FILTERS.searchScope,
    minimumScore: parseMinimumScore(params.get("score")),
    regions: parseCsvEnums<Region>(params.get("regions"), regions),
    amenities: parseCsvEnums<AmenityCategory>(params.get("amenities"), amenityCategories),
    disruptionStatuses: parseCsvEnums<DisruptionStatus>(
      params.get("disruption"),
      disruptionStatuses,
    ),
    sort: parseSort(params.get("sort")),
  };
}

export function serializeDirectorySearchParams(
  filters: AirportFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  const query = filters.query.trim();

  if (query) {
    params.set("q", filters.query);
    if (filters.searchScope !== DEFAULT_DIRECTORY_FILTERS.searchScope) {
      params.set("scope", filters.searchScope);
    }
  }

  if (filters.sort !== DEFAULT_DIRECTORY_FILTERS.sort) {
    params.set("sort", filters.sort);
  }

  if (filters.minimumScore > 0) {
    params.set("score", String(filters.minimumScore));
  }

  const nextRegions = parseCsvEnums<Region>(csv(filters.regions), regions);
  if (nextRegions.length > 0) {
    params.set("regions", csv(nextRegions));
  }

  const nextAmenities = parseCsvEnums<AmenityCategory>(
    csv(filters.amenities),
    amenityCategories,
  );
  if (nextAmenities.length > 0) {
    params.set("amenities", csv(nextAmenities));
  }

  const nextDisruption = parseCsvEnums<DisruptionStatus>(
    csv(filters.disruptionStatuses),
    disruptionStatuses,
  );
  if (nextDisruption.length > 0) {
    params.set("disruption", csv(nextDisruption));
  }

  return params;
}

export function directorySearchHref(
  filters: AirportFilters,
  current?: Pick<URLSearchParams, "toString">,
): string {
  const params = current
    ? new URLSearchParams(current.toString())
    : new URLSearchParams();

  for (const key of DIRECTORY_SEARCH_PARAM_KEYS) {
    params.delete(key);
  }

  const serialized = serializeDirectorySearchParams(filters);
  for (const [key, value] of serialized.entries()) {
    params.set(key, value);
  }

  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function directoryFiltersEqual(
  a: AirportFilters,
  b: AirportFilters,
): boolean {
  return (
    a.query === b.query &&
    a.searchScope === b.searchScope &&
    a.minimumScore === b.minimumScore &&
    a.sort === b.sort &&
    csv(a.regions) === csv(b.regions) &&
    csv(a.amenities) === csv(b.amenities) &&
    csv(a.disruptionStatuses) === csv(b.disruptionStatuses)
  );
}

export function clearDirectoryDataFilters(filters: AirportFilters): AirportFilters {
  return {
    ...filters,
    minimumScore: 0,
    regions: [],
    amenities: [],
    disruptionStatuses: [],
  };
}

export function hasDirectoryDataFilters(filters: AirportFilters): boolean {
  return (
    filters.minimumScore > 0 ||
    filters.regions.length > 0 ||
    filters.amenities.length > 0 ||
    filters.disruptionStatuses.length > 0
  );
}

export function hasDirectoryChipFilters(filters: AirportFilters): boolean {
  return Boolean(filters.query.trim()) || hasDirectoryDataFilters(filters);
}

/**
 * Incoming `searchKey` vs an in-flight `router.replace`. Ignore stale
 * replacements so rapid typing cannot roll filters back; apply when the
 * URL is the source of truth (back/forward, or no write in flight).
 */
export function directoryUrlSyncAction(input: {
  incomingKey: string;
  lastWrittenKey: string | null;
  writeGeneration: number;
  appliedGeneration: number;
}): "apply" | "ignore" | "ack-write" {
  if (input.writeGeneration === input.appliedGeneration) {
    return "apply";
  }
  if (input.incomingKey === (input.lastWrittenKey ?? "")) {
    return "ack-write";
  }
  return "ignore";
}
