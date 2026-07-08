import { regionForCountryCode } from "@/lib/airport-profiles";

export type RideshareProviderId = "uber" | "bolt" | "grab";

export interface RideshareProvider {
  id: RideshareProviderId;
  label: string;
}

const RIDESHARE_PROVIDERS: Record<RideshareProviderId, RideshareProvider> = {
  uber: { id: "uber", label: "Uber" },
  bolt: { id: "bolt", label: "Bolt" },
  grab: { id: "grab", label: "Grab" },
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
  if (region === "Europe" || region === "Africa" || BOLT_EXTRA_COUNTRY_CODES.has(code)) {
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
}

/**
 * Deep link that opens the Uber app (or m.uber.com on desktop/no-app) with
 * pickup pre-filled at the airport. Destination is left for the traveler to
 * enter — we don't know where in the city they're actually headed. This is
 * Uber's documented universal ride-request link; no API key needed.
 * https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction
 */
function buildUberDeepLink(pickup: RidesharePickupPoint): string {
  const params = new URLSearchParams({
    action: "setPickup",
    "pickup[latitude]": String(pickup.latitude),
    "pickup[longitude]": String(pickup.longitude),
    "pickup[nickname]": pickup.nickname,
  });
  return `https://m.uber.com/ul/?${params.toString()}`;
}

/** Bolt's rider deep link — opens the app to a ride request from this pickup point. */
function buildBoltDeepLink(pickup: RidesharePickupPoint): string {
  const params = new URLSearchParams({
    pickup_latitude: String(pickup.latitude),
    pickup_longitude: String(pickup.longitude),
    pickup_address: pickup.nickname,
  });
  return `https://bolt.eu/en/deeplink/?action=client_request_ride&${params.toString()}`;
}

/** Grab's rider deep link — opens the app's booking screen with pickup set. */
function buildGrabDeepLink(pickup: RidesharePickupPoint): string {
  const params = new URLSearchParams({
    screenType: "BOOKING",
    pickUpLatitude: String(pickup.latitude),
    pickUpLongitude: String(pickup.longitude),
    pickUpAddress: pickup.nickname,
  });
  return `https://r.grab.com/app?${params.toString()}`;
}

export function buildRideshareDeepLink(
  provider: RideshareProviderId,
  pickup: RidesharePickupPoint,
): string {
  switch (provider) {
    case "uber":
      return buildUberDeepLink(pickup);
    case "bolt":
      return buildBoltDeepLink(pickup);
    case "grab":
      return buildGrabDeepLink(pickup);
    default: {
      const exhaustiveCheck: never = provider;
      return exhaustiveCheck;
    }
  }
}
