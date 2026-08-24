/**
 * Airport detail tab values (`AirportDetailTabs`) and which ones are paid.
 *
 * Overview and the lounges *list* stay free. Individual lounge pages are
 * gated separately (`/airports/{iata}/lounge/{slug}`).
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
export const FREE_AIRPORT_TAB_VALUES = ["overview", "lounges"] as const;

export type FreeAirportTabValue = (typeof FREE_AIRPORT_TAB_VALUES)[number];

/** Non-default airport tabs that require a live Whop membership (or x402 on `.md`). */
export const PAID_AIRPORT_TAB_VALUES = [
  "getting-there",
  "amenities",
  "tips",
  "water",
  "guide",
  "disruptions",
  "reviews",
] as const;

export type PaidAirportTabValue = (typeof PAID_AIRPORT_TAB_VALUES)[number];

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

/** Tab slugs that have a public `/airports/{iata}/{tab}.md` document. */
export function isAirportTabMarkdownSlug(value: string): boolean {
  return value !== "overview" && isAirportTabValue(value);
}
