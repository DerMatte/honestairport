import type {
  Airport,
  AirportFilters,
  AirportSearchScope,
  AmenityCategory,
  DisruptionStatus,
  Region,
  TipCategory,
  TransportBestFor,
  TransportOption,
} from "@/lib/types";

export const regions: Region[] = [
  "North America",
  "Europe",
  "Asia-Pacific",
  "Middle East",
  "South America",
  "Africa",
];

export const amenityCategories: AmenityCategory[] = [
  "food",
  "lounge",
  "wifi",
  "family",
  "accessibility",
  "transport",
  "shopping",
  "sleep",
];

export const disruptionStatuses: DisruptionStatus[] = [
  "normal",
  "minor",
  "moderate",
  "severe",
];

export function filterAndSortAirports(
  airportList: Airport[],
  filters: AirportFilters,
): Airport[] {
  const normalizedQuery = normalizeSearchValue(filters.query);

  const filtered = airportList.filter((airport) => {
    const matchesQuery = airportMatchesSearch(
      airport,
      normalizedQuery,
      filters.searchScope,
    );

    const matchesScore = airport.airportistScore >= filters.minimumScore;
    const matchesRegion =
      filters.regions.length === 0 || filters.regions.includes(airport.region);
    const matchesAmenities =
      filters.amenities.length === 0 ||
      filters.amenities.every((category) =>
        airport.amenities.some((amenity) => amenity.category === category),
      );
    const matchesDisruption =
      filters.disruptionStatuses.length === 0 ||
      filters.disruptionStatuses.includes(airport.disruption.status);

    return (
      matchesQuery &&
      matchesScore &&
      matchesRegion &&
      matchesAmenities &&
      matchesDisruption
    );
  });

  return filtered.sort((a, b) => {
    switch (filters.sort) {
      case "highest-score":
        return b.airportistScore - a.airportistScore;
      case "most-reviewed":
        return b.reviewCount - a.reviewCount;
      case "least-disruptions":
        return disruptionSeverityRank(a.disruption.status) - disruptionSeverityRank(b.disruption.status);
      default: {
        const exhaustiveCheck: never = filters.sort;
        return exhaustiveCheck;
      }
    }
  });
}

function airportMatchesSearch(
  airport: Airport,
  normalizedQuery: string,
  searchScope: AirportSearchScope,
): boolean {
  if (!normalizedQuery) return true;

  const fields =
    searchScope === "city"
      ? [airport.city]
      : searchScope === "country"
        ? [airport.country]
        : [
            airport.name,
            airport.shortName,
            airport.iata,
            airport.icao,
            airport.city,
            airport.country,
            airport.region,
          ];

  return normalizeSearchValue(fields.join(" ")).includes(normalizedQuery);
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function disruptionSeverityRank(status: DisruptionStatus): number {
  switch (status) {
    case "normal":
      return 0;
    case "minor":
      return 1;
    case "moderate":
      return 2;
    case "severe":
      return 3;
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

export function disruptionLabel(status: DisruptionStatus): string {
  switch (status) {
    case "normal":
      return "Normal";
    case "minor":
      return "Minor";
    case "moderate":
      return "Moderate";
    case "severe":
      return "Severe";
    default: {
      const exhaustiveCheck: never = status;
      return exhaustiveCheck;
    }
  }
}

export function amenityLabel(category: AmenityCategory): string {
  switch (category) {
    case "food":
      return "Food";
    case "lounge":
      return "Has Lounge";
    case "wifi":
      return "Fast WiFi";
    case "family":
      return "Family Friendly";
    case "accessibility":
      return "Accessibility";
    case "transport":
      return "Easy Transport";
    case "shopping":
      return "Shopping";
    case "sleep":
      return "Sleep Options";
    default: {
      const exhaustiveCheck: never = category;
      return exhaustiveCheck;
    }
  }
}

export function tipCategoryLabel(category: TipCategory): string {
  switch (category) {
    case "security":
      return "Security";
    case "food":
      return "Food";
    case "navigation":
      return "Navigation";
    case "layover":
      return "Layover";
    case "transport":
      return "Transport";
    case "family":
      return "Family";
    case "lounge":
      return "Lounge";
    default: {
      const exhaustiveCheck: never = category;
      return exhaustiveCheck;
    }
  }
}

function parseTimeToCityMinutes(timeToCity: string): number | null {
  const numbers = timeToCity.match(/\d+/g)?.map(Number);
  if (!numbers?.length) return null;
  // Ranges like "35-45 min" average out; single values like "15 min" pass through unchanged.
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function parseCostTier(cost: string): number {
  const dollarSigns = cost.match(/\$/g)?.length ?? 0;
  return dollarSigns > 0 ? dollarSigns : 2; // unrecognized format: assume mid-tier
}

function luggageRank(type: TransportOption["type"]): number {
  switch (type) {
    case "taxi":
    case "rideshare":
      return 0;
    case "train":
      return 1;
    case "bus":
    case "metro":
      return 2;
    case "parking":
      return Number.POSITIVE_INFINITY;
    default: {
      const exhaustiveCheck: never = type;
      return exhaustiveCheck;
    }
  }
}

function firstTaggedFor(
  options: TransportOption[],
  key: TransportBestFor,
): TransportOption | undefined {
  return options.find((option) => option.bestFor?.includes(key));
}

/**
 * Picks the one transport option that best serves each traveler priority.
 * Prefers the guide generator's explicit `bestFor` tags (checked per category,
 * since older profiles may have some categories tagged and not others) and
 * falls back to parsing `timeToCity`/`cost`/`type` otherwise. Parking is
 * excluded from every category — it's not a way into the city, it's where
 * you left your own car.
 */
export function pickTransportRecommendations(
  options: TransportOption[],
): Partial<Record<TransportBestFor, TransportOption>> {
  const candidates = options.filter((option) => option.type !== "parking");
  if (!candidates.length) return {};

  const timed = candidates
    .map((option) => ({ option, minutes: parseTimeToCityMinutes(option.timeToCity) }))
    .filter(
      (entry): entry is { option: TransportOption; minutes: number } => entry.minutes !== null,
    );

  const fastest =
    firstTaggedFor(candidates, "fastest") ??
    [...timed].sort((a, b) => a.minutes - b.minutes)[0]?.option;

  const cheapest =
    firstTaggedFor(candidates, "cheapest") ??
    [...candidates].sort((a, b) => parseCostTier(a.cost) - parseCostTier(b.cost))[0];

  const luggage =
    firstTaggedFor(candidates, "luggage") ??
    [...candidates].sort((a, b) => luggageRank(a.type) - luggageRank(b.type))[0];

  return { fastest, cheapest, luggage };
}

export function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
}

/** Formats an ISO date string as a short "how fresh is this guide" label. */
export function formatGuideFreshness(isoDate: string): string {
  const updated = new Date(isoDate);
  const days = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  if (days < 14) return `Updated ${days}d ago`;

  return `Updated ${new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(updated)}`;
}

export function airportJsonLd(airport: Airport) {
  return {
    "@context": "https://schema.org",
    "@type": "Airport",
    name: airport.name,
    iataCode: airport.iata,
    icaoCode: airport.icao,
    address: {
      "@type": "PostalAddress",
      addressLocality: airport.city,
      addressCountry: airport.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: airport.coordinates.latitude,
      longitude: airport.coordinates.longitude,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: airport.airportistScore,
      bestRating: 10,
      ratingCount: airport.reviewCount,
    },
  };
}
