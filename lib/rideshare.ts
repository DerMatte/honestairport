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
 * Deep link that opens the Uber app (or m.uber.com) with pickup — and when
 * known, city-center dropoff — pre-filled so the rider sees a live price/ETA.
 * Optional `NEXT_PUBLIC_UBER_CLIENT_ID` enables partner attribution.
 * https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction
 */
function buildUberDeepLink(options: RideshareDeepLinkOptions): string {
  const { pickup, dropoff } = options;
  const params = new URLSearchParams({ action: "setPickup" });
  const clientId = uberClientId();
  if (clientId) {
    params.set("client_id", clientId);
  }
  params.set("pickup[latitude]", String(pickup.latitude));
  params.set("pickup[longitude]", String(pickup.longitude));
  params.set("pickup[nickname]", pickup.nickname);
  if (pickup.formattedAddress) {
    params.set("pickup[formatted_address]", pickup.formattedAddress);
  }
  if (dropoff) {
    // Nickname (or formatted address) is required for dropoff to render in-app.
    params.set("dropoff[latitude]", String(dropoff.latitude));
    params.set("dropoff[longitude]", String(dropoff.longitude));
    params.set("dropoff[nickname]", dropoff.nickname);
    if (dropoff.formattedAddress) {
      params.set("dropoff[formatted_address]", dropoff.formattedAddress);
    }
  }
  return `https://m.uber.com/ul/?${params.toString()}`;
}

/** Bolt rider deep link — pickup required; dropoff appended when known. */
function buildBoltDeepLink(options: RideshareDeepLinkOptions): string {
  const { pickup, dropoff } = options;
  const params = new URLSearchParams({
    pickup_latitude: String(pickup.latitude),
    pickup_longitude: String(pickup.longitude),
    pickup_address: pickup.nickname,
  });
  if (dropoff) {
    params.set("destination_latitude", String(dropoff.latitude));
    params.set("destination_longitude", String(dropoff.longitude));
    params.set("destination_address", dropoff.nickname);
  }
  return `https://bolt.eu/en/deeplink/?action=client_request_ride&${params.toString()}`;
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
