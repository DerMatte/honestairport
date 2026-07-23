export type Region =
  | "North America"
  | "Europe"
  | "Asia-Pacific"
  | "Middle East"
  | "South America"
  | "Africa";

export type DisruptionStatus = "normal" | "minor" | "moderate" | "severe";

export type AmenityCategory =
  | "food"
  | "lounge"
  | "wifi"
  | "family"
  | "accessibility"
  | "transport"
  | "shopping"
  | "sleep";

export type AmenityQuality = "basic" | "good" | "excellent";

export type TipCategory =
  | "security"
  | "food"
  | "navigation"
  | "layover"
  | "transport"
  | "family"
  | "lounge";

export type ImportantTipCategory = "timing" | "terminal" | "food" | "status";

export type AirportSort =
  | "highest-score"
  | "most-reviewed"
  | "least-disruptions"
  | "newest-guides";

export type AirportSearchScope = "all" | "city" | "country";

export interface Amenity {
  id: string;
  label: string;
  category: AmenityCategory;
  description: string;
  quality: AmenityQuality;
  isFeatured?: boolean;
}

export interface Tip {
  id: string;
  category: TipCategory;
  title: string;
  summary: string;
  details: string;
  pro?: string;
  con?: string;
}

export interface ImportantTip {
  id: string;
  category: ImportantTipCategory;
  label: string;
  title: string;
  summary: string;
  detail?: string;
}

export interface Review {
  id: string;
  author: string;
  tripType: string;
  rating: number;
  title: string;
  body: string;
  date: string;
}

export interface Disruption {
  status: DisruptionStatus;
  departureDelayMinutes: number;
  departureDelayPercent: number;
  arrivalDelayMinutes: number;
  arrivalDelayPercent: number;
  cancellationsPercent: number;
  alerts: string[];
  lastUpdated: Date;
}

/** Which of the airport's transport options wins each traveler priority. */
export type TransportBestFor = "fastest" | "cheapest" | "luggage";

export interface TransportOption {
  type: "train" | "metro" | "bus" | "taxi" | "rideshare" | "parking";
  name: string;
  summary: string;
  timeToCity: string;
  cost: string;
  insiderTip: string;
  /**
   * Editorial call on which traveler priorities this option wins, set by the
   * guide generator when it directly compares this airport's options. Absent
   * on older profiles — `pickTransportRecommendations` (lib/airport-utils.ts)
   * falls back to parsing `timeToCity`/`cost`/`type` when no option in the
   * list has this set.
   */
  bestFor?: TransportBestFor[];
}

export interface AirportScoreBreakdown {
  comfort: number;
  navigation: number;
  food: number;
  transport: number;
  disruptionResilience: number;
}

export interface AirportStats {
  annualPassengers: string;
  terminals: string;
  onTimePercentage: number;
  averageSecurityMinutes: number;
}

export interface Airport {
  slug: string;
  iata: string;
  icao: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  region: Region;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  airportistScore: number;
  scoreBreakdown: AirportScoreBreakdown;
  stats: AirportStats;
  summary: string;
  bestFor: string[];
  watchOutFor: string[];
  amenities: Amenity[];
  importantTips?: ImportantTip[];
  tips: Tip[];
  transport: TransportOption[];
  disruption: Disruption;
  /** Published review count (editorial + community), for sorting/ratingCount display. */
  reviewCount: number;
  /** Guide editorial freshness (`airport_guides.last_updated`, YYYY-MM-DD). */
  guideLastUpdated: string;
}

/**
 * Slim homepage/directory row — only fields cards, filters, and the map need.
 * Keeps full editorial profiles (`tips`, `transport`, …) off the client payload.
 */
export interface AirportDirectoryAirport {
  slug: string;
  iata: string;
  icao: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  region: Region;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  airportistScore: number;
  summary: string;
  reviewCount: number;
  amenities: Array<{
    id: string;
    category: AmenityCategory;
    isFeatured?: boolean;
  }>;
  /** Distinct amenity categories for filters (not rendered on cards). */
  amenityCategories: AmenityCategory[];
  stats: {
    averageSecurityMinutes: number;
  };
  disruption: {
    status: DisruptionStatus;
    departureDelayMinutes: number;
    cancellationsPercent: number;
  };
  /** Guide editorial freshness (`airport_guides.last_updated`, YYYY-MM-DD). */
  guideLastUpdated: string;
}

export interface AirportFilters {
  query: string;
  searchScope: AirportSearchScope;
  minimumScore: number;
  regions: Region[];
  amenities: AmenityCategory[];
  disruptionStatuses: DisruptionStatus[];
  /** Keep only guides published/refreshed within the recent window. */
  recentGuidesOnly: boolean;
  sort: AirportSort;
}
