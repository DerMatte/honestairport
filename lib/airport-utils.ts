import type {
  Airport,
  AirportFilters,
  AirportSearchScope,
  AmenityCategory,
  DisruptionStatus,
  Region,
  TipCategory,
} from "@/lib/types";

export const regions: Region[] = [
  "North America",
  "Europe",
  "Asia-Pacific",
  "Middle East",
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
