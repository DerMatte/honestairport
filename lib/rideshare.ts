import { regionForCountryCode } from "@/lib/airport-profiles";
import type { CityDestination } from "@/lib/city-destination";

export type RideshareProviderId = "uber" | "bolt" | "grab" | "lyft";

export interface RideshareProvider {
  id: RideshareProviderId;
  label: string;
}

const RIDESHARE_PROVIDERS: Record<RideshareProviderId, RideshareProvider> = {
  uber: { id: "uber", label: "Uber" },
  bolt: { id: "bolt", label: "Bolt" },
  grab: { id: "grab", label: "Grab" },
  lyft: { id: "lyft", label: "Lyft" },
};

/** Countries where Uber sold its local business to Grab, or never launched. */
const UBER_UNAVAILABLE_COUNTRY_CODES = new Set([
  "CN", // mainland China — Didi, not Uber
  "RU", // merged into Yandex in 2017
  "SG",
  "MY",
  "TH",
  "ID",
  "VN",
  "KH",
  "MM", // Southeast Asia — sold to Grab in 2018
]);

/** Grab's core Southeast Asia markets. */
const GRAB_COUNTRY_CODES = new Set(["SG", "MY", "TH", "ID", "PH", "VN", "KH", "MM"]);

/** Bolt markets outside its Europe/Africa home turf. */
const BOLT_EXTRA_COUNTRY_CODES = new Set(["MX"]);

/**
 * European / African ISO codes not yet present in `regionForCountryCode` but
 * where Bolt operates — keeps buttons from disappearing on smaller markets.
 */
const BOLT_EUROPE_AFRICA_FALLBACK = new Set([
  "AL",
  "BA",
  "BG",
  "BY",
  "CY",
  "EE",
  "GE",
  "HR",
  "LT",
  "LU",
  "LV",
  "MD",
  "ME",
  "MK",
  "MT",
  "RO",
  "RS",
  "SI",
  "SK",
  "UA",
  "XK",
  "GH",
  "KE",
  "MA",
  "NG",
  "TZ",
  "UG",
]);

const LYFT_COUNTRY_CODES = new Set(["US", "CA"]);

/**
 * Approximate rideshare coverage by airport country, so we don't show a
 * button that just fails for the traveler. Necessarily incomplete — extend
 * these sets as coverage changes or a new country shows up in the dataset.
 */
export function getRideshareProviders(countryCode: string): RideshareProvider[] {
  const code = countryCode.trim().toUpperCase();
  const region = regionForCountryCode(code);
  const providers: RideshareProvider[] = [];

  if (!UBER_UNAVAILABLE_COUNTRY_CODES.has(code)) {
    providers.push(RIDESHARE_PROVIDERS.uber);
  }
  if (LYFT_COUNTRY_CODES.has(code)) {
    providers.push(RIDESHARE_PROVIDERS.lyft);
  }
  if (
    region === "Europe" ||
    region === "Africa" ||
    BOLT_EXTRA_COUNTRY_CODES.has(code) ||
    BOLT_EUROPE_AFRICA_FALLBACK.has(code)
  ) {
    providers.push(RIDESHARE_PROVIDERS.bolt);
  }
  if (GRAB_COUNTRY_CODES.has(code)) {
    providers.push(RIDESHARE_PROVIDERS.grab);
  }

  return providers;
}

export interface RidesharePickupPoint {
  latitude: number;
  longitude: number;
  nickname: string;
  formattedAddress?: string;
}

export interface RideshareDropoffPoint {
  latitude: number;
  longitude: number;
  nickname: string;
  formattedAddress?: string;
}

export interface RideshareDeepLinkOptions {
  pickup: RidesharePickupPoint;
  dropoff?: RideshareDropoffPoint | null;
}

function uberClientId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_UBER_CLIENT_ID?.trim();
  return id || undefined;
}

/**
 * Uber `/looking` Location JSON (url-encoded as a query value).
 * https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction
 */
function encodeUberLookingLocation(
  point: RidesharePickupPoint | RideshareDropoffPoint,
): string {
  const location: {
    latitude: number;
    longitude: number;
    addressLine1: string;
    addressLine2?: string;
  } = {
    latitude: point.latitude,
    longitude: point.longitude,
    addressLine1: point.nickname,
  };
  if (point.formattedAddress) {
    location.addressLine2 = point.formattedAddress;
  }
  return JSON.stringify(location);
}

/**
 * Deep link that opens the Uber app (or m.uber.com/looking) with pickup — and
 * when known, city-center dropoff — pre-filled so the rider sees product
 * selection with a live price/ETA. Optional `NEXT_PUBLIC_UBER_CLIENT_ID`
 * enables partner attribution.
 * https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction
 */
function buildUberDeepLink(options: RideshareDeepLinkOptions): string {
  const { pickup, dropoff } = options;
  const params = new URLSearchParams();
  const clientId = uberClientId();
  if (clientId) {
    params.set("client_id", clientId);
  }
  params.set("pickup", encodeUberLookingLocation(pickup));
  if (dropoff) {
    params.set("drop[0]", encodeUberLookingLocation(dropoff));
  }
  return `https://m.uber.com/looking?${params.toString()}`;
}

/**
 * Bolt no longer publishes a working param-preserving web deeplink.
 * The former `https://bolt.eu/en/deeplink/?action=client_request_ride…` URL
 * returns HTTP 404. Undocumented `bolt://ride?…` schemes are app-only and
 * unsuitable as https fallbacks, and inventing query params on marketing
 * pages would claim a prefill Bolt ignores. Open the rides landing instead
 * (get-app / store CTAs); pickup/dropoff are intentionally omitted.
 */
function buildBoltDeepLink(_options: RideshareDeepLinkOptions): string {
  return "https://bolt.eu/en/rides/";
}

/**
 * Whether the provider's deep link actually prefills pickup/dropoff.
 * Used so UI copy (e.g. "→ city") stays honest when a vendor only opens
 * the app/store without route params.
 */
export function rideshareDeepLinkPrefillsRoute(
  provider: RideshareProviderId,
): boolean {
  switch (provider) {
    case "uber":
    case "grab":
    case "lyft":
      return true;
    case "bolt":
      return false;
    default: {
      const exhaustiveCheck: never = provider;
      return exhaustiveCheck;
    }
  }
}

/** Grab rider deep link — booking screen with pickup (and dropoff when known). */
function buildGrabDeepLink(options: RideshareDeepLinkOptions): string {
  const { pickup, dropoff } = options;
  const params = new URLSearchParams({
    screenType: "BOOKING",
    pickUpLatitude: String(pickup.latitude),
    pickUpLongitude: String(pickup.longitude),
    pickUpAddress: pickup.nickname,
  });
  if (dropoff) {
    params.set("dropOffLatitude", String(dropoff.latitude));
    params.set("dropOffLongitude", String(dropoff.longitude));
    params.set("dropOffAddress", dropoff.nickname);
  }
  return `https://r.grab.com/app?${params.toString()}`;
}

/** Lyft deep link (US/CA) with optional destination for in-app quotes. */
function buildLyftDeepLink(options: RideshareDeepLinkOptions): string {
  const { pickup, dropoff } = options;
  const params = new URLSearchParams({
    id: "lyft",
    "pickup[latitude]": String(pickup.latitude),
    "pickup[longitude]": String(pickup.longitude),
  });
  if (dropoff) {
    params.set("destination[latitude]", String(dropoff.latitude));
    params.set("destination[longitude]", String(dropoff.longitude));
  }
  return `https://lyft.com/ride?${params.toString()}`;
}

export function buildRideshareDeepLink(
  provider: RideshareProviderId,
  pickupOrOptions: RidesharePickupPoint | RideshareDeepLinkOptions,
  dropoff?: RideshareDropoffPoint | null,
): string {
  const options: RideshareDeepLinkOptions =
    "pickup" in pickupOrOptions
      ? pickupOrOptions
      : { pickup: pickupOrOptions, dropoff: dropoff ?? null };

  switch (provider) {
    case "uber":
      return buildUberDeepLink(options);
    case "bolt":
      return buildBoltDeepLink(options);
    case "grab":
      return buildGrabDeepLink(options);
    case "lyft":
      return buildLyftDeepLink(options);
    default: {
      const exhaustiveCheck: never = provider;
      return exhaustiveCheck;
    }
  }
}

/** Convenience: build a dropoff point from a resolved city destination. */
export function cityDestinationToDropoff(
  city: CityDestination,
): RideshareDropoffPoint {
  return {
    latitude: city.latitude,
    longitude: city.longitude,
    nickname: `${city.name} city center`,
    formattedAddress: `${city.name} city center`,
  };
}

/**
 * Optional Impact / Uber affiliate landing URL for new-rider acquisition.
 * Existing riders booking via deep links do not generate trip commission;
 * this link is the acquisition track when the publisher is approved.
 */
export function getUberAffiliateSignupUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_UBER_AFFILIATE_URL?.trim();
  return url || undefined;
}
