import type { TransportOption } from "@/lib/types";

const FARE_PATTERN =
  /(?:flat\s*)?(?:US\s*)?(?:USD\s*)?([$€£¥]|EUR|USD|GBP|AUD|CAD|SGD|THB|AED|JPY|₩|₹)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)(?:\s*[-–]\s*(?:[$€£¥]|EUR|USD|GBP)?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?))?/gi;

const CURRENCY_SYMBOL: Record<string, string> = {
  $: "$",
  USD: "$",
  "€": "€",
  EUR: "€",
  "£": "£",
  GBP: "£",
  "¥": "¥",
  JPY: "¥",
  "₩": "₩",
  "₹": "₹",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  THB: "฿",
  AED: "AED ",
};

export interface TypicalCityFare {
  /** Display string like "$70" or "€45–60". */
  label: string;
  /** Which transport option the fare was taken from. */
  sourceName: string;
  sourceType: TransportOption["type"];
  /** Raw matched snippet for debugging / tooltips. */
  raw: string;
}

function normalizeCurrency(token: string): string {
  const key = token.trim().toUpperCase();
  if (CURRENCY_SYMBOL[token]) return CURRENCY_SYMBOL[token];
  if (CURRENCY_SYMBOL[key]) return CURRENCY_SYMBOL[key];
  return token;
}

function formatAmount(raw: string): string {
  return raw.replace(/,/g, "");
}

function extractFaresFromText(text: string): Array<{ label: string; raw: string }> {
  const found: Array<{ label: string; raw: string }> = [];
  for (const match of text.matchAll(FARE_PATTERN)) {
    const currency = normalizeCurrency(match[1] ?? "");
    const low = formatAmount(match[2] ?? "");
    const high = match[3] ? formatAmount(match[3]) : null;
    if (!low) continue;
    const label = high ? `${currency}${low}–${high}` : `${currency}${low}`;
    found.push({ label, raw: match[0].trim() });
  }
  return found;
}

const TAXI_LIKE = new Set<TransportOption["type"]>(["taxi", "rideshare"]);

/**
 * Pull a typical airport→city fare from editorial transport copy. Prefers
 * taxi/rideshare tips (where flat rates and app estimates usually live), then
 * any other option that mentions a concrete currency amount.
 */
export function pickTypicalCityFare(
  options: TransportOption[],
): TypicalCityFare | null {
  const ranked = [
    ...options.filter((option) => TAXI_LIKE.has(option.type)),
    ...options.filter((option) => !TAXI_LIKE.has(option.type) && option.type !== "parking"),
  ];

  for (const option of ranked) {
    const haystack = [option.insiderTip, option.summary, option.cost].join(" · ");
    const fares = extractFaresFromText(haystack);
    // Skip bare "$" / "$$" cost tiers — those are relative, not prices.
    const concrete = fares.find((fare) => !/^\$+$/.test(fare.raw.replace(/\s/g, "")));
    if (!concrete) continue;
    // Relative cost fields like "$$" also match the regex poorly; ignore when
    // the only digits came from an empty capture (already guarded) or when the
    // source string is only dollar signs.
    if (/^\$+$/.test(option.cost.trim()) && haystack.trim() === option.cost.trim()) {
      continue;
    }
    return {
      label: concrete.label,
      sourceName: option.name,
      sourceType: option.type,
      raw: concrete.raw,
    };
  }

  return null;
}

/**
 * Prefer rideshare options for in-app booking CTAs; fall back to taxi. Using
 * `.find(taxi|rideshare)` previously pinned buttons to Yellow Cab / RTA Taxi
 * cards even when a dedicated Uber/Grab row existed later in the list.
 */
export function pickRideBookingOption(
  options: TransportOption[],
): TransportOption | undefined {
  return (
    options.find((option) => option.type === "rideshare") ??
    options.find((option) => option.type === "taxi")
  );
}
