/**
 * Airport detail tab values (`AirportDetailTabs`) and which ones are paid.
 *
 * Overview, Getting There, and the lounges *list* stay free. Individual
 * lounge pages are gated separately (`/airports/{iata}/lounge/{slug}`).
 */

export const AIRPORT_TAB_VALUES = [
  "overview",
  "getting-there",
  "lounges",
  "amenities",
  "tips",
  "water",
  "guide",
  "disruptions",
  "reviews",
] as const;

export type AirportTabValue = (typeof AIRPORT_TAB_VALUES)[number];

/** Tabs anyone can open on the airport page when the Whop gate is on. */
export const FREE_AIRPORT_TAB_VALUES = [
  "overview",
  "getting-there",
  "lounges",
] as const;

export type FreeAirportTabValue = (typeof FREE_AIRPORT_TAB_VALUES)[number];

/** Non-default airport tabs that require a live Whop membership (or x402 on `.md`). */
export const PAID_AIRPORT_TAB_VALUES = [
  "amenities",
  "tips",
  "water",
  "guide",
  "disruptions",
  "reviews",
] as const;

export type PaidAirportTabValue = (typeof PAID_AIRPORT_TAB_VALUES)[number];

/** Tab slugs that have a public `/airports/{iata}/{tab}.md` document. */
export type AirportTabMarkdownSlug = Exclude<AirportTabValue, "overview">;

export const AIRPORT_TAB_LABELS = {
  overview: "Overview",
  "getting-there": "Getting There",
  lounges: "Lounges",
  amenities: "Amenities",
  tips: "Traveler Tips",
  water: "Water",
  guide: "Full Guide",
  disruptions: "Disruptions",
  reviews: "Reviews",
} as const satisfies Record<AirportTabValue, string>;

const AIRPORT_TAB_SET = new Set<string>(AIRPORT_TAB_VALUES);
const FREE_AIRPORT_TAB_SET = new Set<string>(FREE_AIRPORT_TAB_VALUES);
const PAID_AIRPORT_TAB_SET = new Set<string>(PAID_AIRPORT_TAB_VALUES);

export function isAirportTabValue(value: string): value is AirportTabValue {
  return AIRPORT_TAB_SET.has(value);
}

export function isFreeAirportTab(value: string): value is FreeAirportTabValue {
  return FREE_AIRPORT_TAB_SET.has(value);
}

export function isPaidAirportTab(value: string): value is PaidAirportTabValue {
  return PAID_AIRPORT_TAB_SET.has(value);
}

export function isAirportTabMarkdownSlug(
  value: string,
): value is AirportTabMarkdownSlug {
  return value !== "overview" && isAirportTabValue(value);
}

export function airportTabLabel(tab: AirportTabValue): string {
  return AIRPORT_TAB_LABELS[tab];
}

/**
 * Deep-link helper for `?tab=`. Invalid or hidden tabs fall back to overview.
 */
export function resolveAirportTab(
  requested: string | null | undefined,
  visibleTabs: readonly string[],
): AirportTabValue {
  if (
    requested &&
    isAirportTabValue(requested) &&
    visibleTabs.includes(requested)
  ) {
    return requested;
  }
  return "overview";
}
