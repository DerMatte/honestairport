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

export type AirportSort = "highest-score" | "most-reviewed" | "least-disruptions";

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

export interface TransportOption {
  type: "train" | "metro" | "bus" | "taxi" | "rideshare" | "parking";
  name: string;
  summary: string;
  timeToCity: string;
  cost: string;
  insiderTip: string;
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
}

export interface AirportFilters {
  query: string;
  searchScope: AirportSearchScope;
  minimumScore: number;
  regions: Region[];
  amenities: AmenityCategory[];
  disruptionStatuses: DisruptionStatus[];
  sort: AirportSort;
}
