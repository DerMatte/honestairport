/**
 * Shared airport research pipeline pieces: the structured-JSON output schema,
 * the research prompt, and the converters that turn a validated model response
 * into an `AirportContent` guide and an `AirportProfileInput` score profile.
 *
 * Used by both research-capable generators:
 *  - scripts/generate-airport-grok.ts (local `grok` CLI, VPS cron)
 *  - scripts/rebuild-airports-gateway.ts (Vercel AI Gateway batch rebuild)
 * so the two pipelines can never drift on what a valid guide + profile is.
 */

import { z } from "zod";
import type { AirportContent } from "../lib/airport-guides";
import {
  amenitySchema,
  boundedArray,
  disruptionSchema,
  nonEmpty,
  optionalNonEmpty,
  profileTipSchema,
  regionSchema,
  scoreBreakdownSchema,
  scoreSchema,
  statsSchema,
  transportOptionSchema,
} from "../lib/airport-profile-schema";
import {
  regionForCountryCode,
  type AirportProfileInput,
} from "../lib/airport-profiles";
import { getAirportByIata } from "../lib/airports";

// --- Model output schema --------------------------------------------------------
//
// Model JSON occasionally drifts slightly outside the shape asked for in the
// prompt (an empty "hours": "" instead of omitting the key, one lounge or
// trick over the cap). Rather than failing the whole run over that, treat it
// as recoverable: blank optional strings become undefined, and over-long
// lists get truncated to the max instead of rejected. The primitives and all
// Airportist Score profile shapes live in `lib/airport-profile-schema.ts`,
// shared with the on-demand web generator so all pipelines agree on what a
// valid profile is.

const loungeSchema = z.object({
  name: nonEmpty,
  terminal: nonEmpty,
  zone: optionalNonEmpty,
  access: z.array(nonEmpty).optional(),
  hours: optionalNonEmpty,
  amenities: z.array(nonEmpty).optional(),
  bestFor: z.array(nonEmpty).optional(),
  verdict: z.enum(["worth-it", "depends", "skip"]).optional(),
  summary: nonEmpty,
});

const waterOptionSchema = z
  .object({
    kind: z.enum(["purchase", "refill", "free"]),
    name: nonEmpty,
    terminal: nonEmpty,
    location: nonEmpty.min(
      12,
      "must name a walkable landmark (e.g. next to Heinemann, opposite McDonald's)",
    ),
    zone: z.enum(["airside", "landside"]).optional(),
    price: optionalNonEmpty,
    summary: nonEmpty,
    isBestValue: z.boolean().optional(),
    isBestQuality: z.boolean().optional(),
  })
  .superRefine((option, ctx) => {
    if (option.kind === "purchase" && !option.price) {
      ctx.addIssue({
        code: "custom",
        message: "purchase options must include a price",
        path: ["price"],
      });
    }

    if (option.location.trim().toLowerCase() === option.terminal.trim().toLowerCase()) {
      ctx.addIssue({
        code: "custom",
        message: "location must be more specific than the terminal name alone",
        path: ["location"],
      });
    }
  });

// --- Airportist Score profile fields ---------------------------------------------
//
// The same research pass also produces the scoring profile (airport_profiles
// table): Airportist Score, amenities, tips, transport options, and a
// disruption snapshot — field shapes imported from
// `lib/airport-profile-schema.ts`. icao/latitude/longitude/region are never
// asked of the model — they're looked up deterministically (see
// `buildProfileInput`) to avoid hallucinated geo/classification data.

export const guideJsonSchema = z.object({
  iata: z.string().regex(/^[A-Z]{3}$/),
  name: nonEmpty,
  city: nonEmpty,
  country: nonEmpty,
  summary: nonEmpty.describe("One-sentence high-signal summary"),
  officialWebsite: z.url().describe("The airport's official website homepage"),
  sources: z.array(z.url()).min(3),
  quickFacts: boundedArray(nonEmpty, 4, 6),
  bentoTips: z
    .array(
      z.object({
        category: z.enum(["timing", "terminal", "food", "status"]),
        label: nonEmpty,
        title: nonEmpty,
        summary: nonEmpty,
        detail: optionalNonEmpty,
      }),
    )
    .length(4)
    .refine(
      (tips) => new Set(tips.map((tip) => tip.category)).size === 4,
      "bentoTips must cover all four categories exactly once",
    ),
  lounges: boundedArray(loungeSchema, 2, 6),
  waterOptions: boundedArray(waterOptionSchema, 2, 6).superRefine((options, ctx) => {
    const bestValueCount = options.filter((option) => option.isBestValue).length;
    const bestQualityCount = options.filter((option) => option.isBestQuality).length;

    if (bestValueCount !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "exactly one water option must set isBestValue: true",
      });
    }

    if (bestQualityCount > 1) {
      ctx.addIssue({
        code: "custom",
        message: "at most one water option may set isBestQuality: true",
      });
    }
  }),
  securityTips: boundedArray(nonEmpty, 3, 8),
  airportTricks: boundedArray(nonEmpty, 5, 8),
  terminalNavigation: boundedArray(nonEmpty, 3, 8),
  loungesAmenities: boundedArray(nonEmpty, 3, 8),
  groundTransport: boundedArray(nonEmpty, 3, 8),
  // Airportist Score profile
  shortName: nonEmpty.describe("Short recognizable name, e.g. 'London Heathrow'"),
  region: regionSchema,
  scoreSummary: nonEmpty.describe(
    "One evaluative sentence on the airport's overall traveler experience and key tradeoff",
  ),
  airportistScore: scoreSchema,
  scoreBreakdown: scoreBreakdownSchema,
  stats: statsSchema,
  bestFor: boundedArray(nonEmpty, 2, 4),
  watchOutFor: boundedArray(nonEmpty, 2, 4),
  amenities: boundedArray(amenitySchema, 4, 6),
  tips: boundedArray(profileTipSchema, 3, 5),
  transport: boundedArray(transportOptionSchema, 2, 4),
  disruption: disruptionSchema,
});

export type GuideJson = z.infer<typeof guideJsonSchema>;

// --- Prompt ---------------------------------------------------------------------

export function buildResearchPrompt(iata: string, extraInstructions = ""): string {
  const normalizedIata = iata.toUpperCase();

  return `You are an expert travel researcher creating the single best, most practical guide for ${normalizedIata} airport.

STEP 1 — RESEARCH (do this before writing anything):
Use web search and web fetch extensively. Consult, at minimum:
- The official airport website (terminals, security, lounges, transport, parking).
- Frequent-flyer community forums for real traveler tricks and honest lounge opinions:
  - https://www.vielfliegertreff.de/forum/forums/airports-lounges (German — translate the insights, prefer threads from the last 2 years)
  - FlyerTalk forums and relevant Reddit threads.
- Official transport operators (trains, buses, metro) for current prices and timings.
Verify that lounge information is current (lounges open/close often). Only state access rules, hours, and prices you found in your research; omit a field rather than guessing. Prefer specific, recent, insider knowledge over generic airport advice.

STEP 2 — OUTPUT:
Respond with ONLY a single JSON object (no markdown, no code fences, no commentary) in exactly this shape:

{
  "iata": "${normalizedIata}",
  "name": "Full official airport name",
  "city": "City",
  "country": "Country",
  "summary": "One-sentence high-signal summary of why this guide is useful.",
  "officialWebsite": "https://... — the airport's official website homepage (the operator's own site, not Wikipedia or an unofficial info site)",
  "sources": ["https://...", "at least 3 real URLs you actually used, official site first, include forum threads you drew from"],
  "quickFacts": ["4-6 short, truly important facts (terminals, major airlines, unique characteristics)"],
  "bentoTips": [
    { "category": "timing", "label": "Timing", "title": "Short imperative headline", "summary": "One actionable sentence.", "detail": "One extra sentence of context." },
    { "category": "terminal", ... },
    { "category": "food", ... },
    { "category": "status", ... }
  ],
  "lounges": [
    {
      "name": "Official lounge name",
      "terminal": "Terminal 1",
      "zone": "non-Schengen (optional; omit if not applicable)",
      "access": ["Priority Pass", "Star Alliance Gold", "Day pass ~€50"],
      "hours": "05:00-22:00 (omit if unsure)",
      "amenities": ["Showers", "Quiet zone"],
      "bestFor": ["Work", "Long layovers"],
      "verdict": "worth-it | depends | skip",
      "summary": "One honest sentence on whether this lounge is worth the visit, informed by forum opinions."
    }
  ],
  "waterOptions": [
    {
      "kind": "purchase | refill | free",
      "name": "Vendor or fountain name",
      "terminal": "Terminal 4",
      "location": "Required — specific walkable reference, e.g. 'Next to Heinemann duty-free, departures hall' or 'Opposite McDonald's, airside near Gate B12'",
      "zone": "airside | landside (optional)",
      "price": "Required for purchase options, e.g. €1.80 for 500ml",
      "summary": "One honest sentence on why this is the cheapest bottle, best refill spot, or free option.",
      "isBestValue": true,
      "isBestQuality": false
    }
  ],
  "securityTips": ["3-8 actionable security/screening tips specific to this airport (fast-track options, known pain points, times of day to avoid)"],
  "airportTricks": ["5-8 genuinely clever tricks experienced travelers actually use here — be specific, include context like 'works best when...' or 'avoid if...'"],
  "terminalNavigation": ["3-8 items: walking times, best connections, common mistakes"],
  "loungesAmenities": ["3-8 items: honest picks for lounges, standout food, quiet spots"],
  "groundTransport": ["3-8 items: best ways in/out, current costs, insider timing tips"],
  "shortName": "Short recognizable name, e.g. 'London Heathrow' or 'Tokyo Haneda'",
  "region": "North America|Europe|Asia-Pacific|Middle East|South America|Africa",
  "scoreSummary": "One evaluative sentence: the airport's overall traveler experience and its main tradeoff (e.g. 'X has great food but punishing curbside logistics').",
  "airportistScore": 7.4,
  "scoreBreakdown": { "comfort": 7.1, "navigation": 6.7, "food": 7.6, "transport": 7.9, "disruptionResilience": 7.4 },
  "stats": { "annualPassengers": "62M", "terminals": "5 active terminals", "onTimePercentage": 73, "averageSecurityMinutes": 22 },
  "bestFor": ["2-4 short phrases: what this airport genuinely does well"],
  "watchOutFor": ["2-4 short phrases: real, specific pain points"],
  "amenities": [
    { "label": "Short label", "category": "food|lounge|wifi|family|accessibility|transport|shopping|sleep", "description": "One sentence, specific to this airport.", "quality": "basic|good|excellent", "isFeatured": true },
    "... 4-6 amenity objects total — never fewer than 4. category MUST be one of the eight listed values."
  ],
  "tips": [
    { "category": "security|food|navigation|layover|transport|family|lounge", "title": "Short imperative headline", "summary": "One actionable sentence.", "details": "1-2 sentences of specific context.", "pro": "optional upside", "con": "optional downside" },
    "... 3-5 tip objects total — never fewer than 3."
  ],
  "transport": [
    { "type": "train|metro|bus|taxi|rideshare|parking", "name": "Service name", "summary": "One sentence.", "timeToCity": "35-45 min", "cost": "$ | $$ | $$$", "insiderTip": "One specific, actionable sentence.", "bestFor": ["fastest", "cheapest", "luggage"] },
    "... 2-4 transport objects total."
  ],
  "disruption": {
    "status": "normal|minor|moderate|severe",
    "departureDelayMinutes": 20,
    "departureDelayPercent": 25,
    "arrivalDelayMinutes": 15,
    "arrivalDelayPercent": 20,
    "cancellationsPercent": 1.5,
    "alerts": ["0-4 short, current, specific operational notes; omit if nothing notable"]
  }
}

Rules:
- Exactly 4 bentoTips, one per category, in the order timing, terminal, food, status. These are shown prominently — no generic advice.
- For \`transport\`, compare the non-parking options against each other and tag the actual winners with \`bestFor\`: the single fastest (shortest real-world timeToCity), the single cheapest (lowest cost tier), and the single best for a traveler with a lot of luggage (favor door-to-door taxi/rideshare or a step-free dedicated airport train over a crowded metro/bus with stairs and turnstiles). One option can win more than one category if it genuinely does (omit \`bestFor\` entirely on options that don't win anything, and never tag \`parking\`).
- 2-6 lounges covering the most relevant options for ordinary travelers (Priority Pass / independent lounges plus flagship airline lounges).
- Hard minimums (responses below these are rejected): 4-6 amenities, 3-5 tips, 2-4 transport options, 2-4 bestFor, 2-4 watchOutFor, 4-6 quickFacts, 3+ securityTips, 5+ airportTricks, 3+ items each for terminalNavigation, loungesAmenities, and groundTransport.
- Use only the listed enum values. For transport \`type\`, classify trams/light rail/subway as "metro", shuttles/coaches as "bus", and mention the real mode name in \`name\` (e.g. "Edinburgh Trams").
- 2-6 waterOptions covering the cheapest bottle purchase, at least one refill or free option, with exactly one isBestValue and at most one isBestQuality. Include real prices for purchase options when you find them. Every option must include a specific \`location\` anchored to a nearby shop, gate cluster, or landmark — never terminal name alone (e.g. "Next to WHSmith opposite Gate 12", "Refill fountain beside the Starbucks in Pier C").
- Tone: direct, slightly opinionated, zero fluff. Prioritize traveler time-saving and stress reduction.
- All facts must come from your research, not memory alone.
- Do not create or modify any files. Your only deliverable is the JSON response.
${extraInstructions ? `- Additional focus: ${extraInstructions}` : ""}

STEP 3 — SCORING (Airportist Score, 0-10 scale, one decimal):
Research this specifically: recent on-time/delay statistics (e.g. FAA/BTS data for US airports, Eurocontrol/flight-tracking sites elsewhere, or the airport's own published performance reports), typical security wait times, and forum sentiment on comfort and congestion. Calibrate against these anchors:
- 9.0-10: exceptional, best-in-class (e.g. Singapore Changi tier) — reserve for airports with genuinely outstanding, well-documented traveler experience.
- 7.5-8.9: very good, few real complaints.
- 6.0-7.4: solid but with clear, specific tradeoffs.
- Below 6.0: real, well-documented traveler pain points (chronic delays, poor facilities, notoriously difficult layout).
Do not cluster every airport at 7-8 — differentiate based on what you actually find. \`airportistScore\` should read as a holistic judgment close to (but not necessarily exactly) the average of \`scoreBreakdown\`'s five components.
\`disruption\` is a periodic editorial snapshot (not live data — a separate live-status system already covers real-time delays elsewhere on the site), refreshed each time this airport is re-scored; base it on the operational-performance data you researched, not on today's weather.

IATA: ${normalizedIata}`;
}

// --- Pre-validation normalization ---------------------------------------------------

// Models regularly label real-world modes the enum doesn't have (Edinburgh's
// airport link is genuinely a tram). Map the common synonyms onto the enum
// instead of burning a whole research pass over one label.
const TRANSPORT_TYPE_ALIASES: Record<string, string> = {
  tram: "metro",
  "light rail": "metro",
  "light-rail": "metro",
  subway: "metro",
  rail: "train",
  shuttle: "bus",
  coach: "bus",
  car: "rideshare",
  uber: "rideshare",
  lyft: "rideshare",
};

const AMENITY_CATEGORIES = new Set([
  "food",
  "lounge",
  "wifi",
  "family",
  "accessibility",
  "transport",
  "shopping",
  "sleep",
]);

const AMENITY_CATEGORY_ALIASES: Record<string, string> = {
  dining: "food",
  restaurant: "food",
  cafe: "food",
  retail: "shopping",
  "duty-free": "shopping",
  internet: "wifi",
  charging: "wifi",
  work: "wifi",
  connectivity: "wifi",
  rest: "sleep",
  quiet: "sleep",
  relaxation: "sleep",
  spa: "sleep",
  wellness: "sleep",
  kids: "family",
  children: "family",
  play: "family",
};

const TIP_CATEGORIES = new Set([
  "security",
  "food",
  "navigation",
  "layover",
  "transport",
  "family",
  "lounge",
]);

const TIP_CATEGORY_ALIASES: Record<string, string> = {
  dining: "food",
  transit: "transport",
  connection: "layover",
  connections: "layover",
  transfer: "layover",
  terminal: "navigation",
  timing: "navigation",
  arrival: "navigation",
  departure: "navigation",
};

function normalizeCategory(
  item: unknown,
  allowed: Set<string>,
  aliases: Record<string, string>,
): boolean {
  if (typeof item !== "object" || item === null || !("category" in item)) {
    return false;
  }
  const typed = item as { category: unknown };
  if (typeof typed.category !== "string") {
    return false;
  }
  const lowered = typed.category.trim().toLowerCase();
  typed.category = aliases[lowered] ?? lowered;
  return allowed.has(typed.category as string);
}

/**
 * Best-effort cleanup of a raw model JSON candidate before schema validation:
 * map common enum synonyms onto the allowed values, drop list items whose
 * category is unsalvageable, and strip invalid optional fields. Anything
 * still short of the schema minimums after this fails validation as before
 * (and gets another research pass with error feedback).
 */
export function normalizeGuideCandidate(candidate: unknown): unknown {
  if (typeof candidate !== "object" || candidate === null) {
    return candidate;
  }

  const guide = candidate as {
    transport?: unknown;
    amenities?: unknown;
    tips?: unknown;
    waterOptions?: unknown;
  };

  if (Array.isArray(guide.transport)) {
    for (const option of guide.transport) {
      if (typeof option === "object" && option !== null && "type" in option) {
        const typed = option as { type: unknown };
        if (typeof typed.type === "string") {
          typed.type = TRANSPORT_TYPE_ALIASES[typed.type.trim().toLowerCase()] ?? typed.type;
        }
      }
    }
  }

  if (Array.isArray(guide.amenities)) {
    guide.amenities = guide.amenities.filter((item) =>
      normalizeCategory(item, AMENITY_CATEGORIES, AMENITY_CATEGORY_ALIASES),
    );
  }

  if (Array.isArray(guide.tips)) {
    guide.tips = guide.tips.filter((item) =>
      normalizeCategory(item, TIP_CATEGORIES, TIP_CATEGORY_ALIASES),
    );
  }

  if (Array.isArray(guide.waterOptions)) {
    for (const option of guide.waterOptions) {
      if (typeof option === "object" && option !== null && "zone" in option) {
        const typed = option as { zone?: unknown };
        if (typed.zone !== "airside" && typed.zone !== "landside") {
          delete typed.zone;
        }
      }
    }
  }

  return candidate;
}

// --- JSON -> AirportContent -------------------------------------------------------

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function toAirportContent(guide: GuideJson): AirportContent {
  const today = new Date().toISOString().slice(0, 10);

  const content = `# ${guide.iata} Airport Guide

> ${guide.summary}

## Quick Facts
${bullets(guide.quickFacts)}

## Security & Screening Tips
${bullets(guide.securityTips)}

## Best Airport Tricks & Hacks
${bullets(guide.airportTricks)}

## Terminals & Navigation
${bullets(guide.terminalNavigation)}

## Lounges, Food & Amenities
${bullets(guide.loungesAmenities)}

## Water & Hydration
${bullets(
  guide.waterOptions.map((option) => {
    const zone = option.zone ? ` (${option.zone})` : "";
    const price = option.price ? ` — ${option.price}` : "";
    return `${option.name}, ${option.terminal}${zone} — ${option.location}${price}: ${option.summary}`;
  }),
)}

## Ground Transport & Parking
${bullets(guide.groundTransport)}

## Official Sources
${bullets(guide.sources)}
`;

  return {
    frontmatter: {
      iata: guide.iata,
      name: guide.name,
      city: guide.city,
      country: guide.country,
      lastUpdated: today,
      officialWebsite: guide.officialWebsite,
      sources: guide.sources,
      quickFacts: guide.quickFacts,
      bentoTips: guide.bentoTips,
      lounges: guide.lounges,
      waterOptions: guide.waterOptions,
    },
    content,
  };
}

// --- JSON -> AirportProfileInput --------------------------------------------------

/**
 * icao/latitude/longitude come from the local airport reference data
 * (`lib/airports.ts`), never from the model — they're verifiable facts we
 * already have, not something worth risking a hallucination on. Region uses
 * the deterministic country-code map when available (it drives filter
 * grouping and must stay internally consistent); the model's answer only
 * fills the gap for countries not mapped yet, same as the on-demand web
 * generator.
 */
export function buildProfileInput(iata: string, guide: GuideJson): AirportProfileInput {
  const record = getAirportByIata(iata);
  if (!record) {
    throw new Error(`No reference airport record for ${iata}; cannot build a scoring profile.`);
  }

  return {
    // Empty when the reference record has no ICAO (smaller airfields) — UI
    // and JSON-LD treat "" as absent rather than blocking the score.
    icao: record.icao_code ?? "",
    shortName: guide.shortName,
    region: regionForCountryCode(record.iata_country_code) ?? guide.region,
    latitude: record.latitude,
    longitude: record.longitude,
    airportistScore: guide.airportistScore,
    scoreBreakdown: guide.scoreBreakdown,
    stats: guide.stats,
    summary: guide.scoreSummary,
    bestFor: guide.bestFor,
    watchOutFor: guide.watchOutFor,
    amenities: guide.amenities.map((amenity, index) => ({
      id: `${iata.toLowerCase()}-amenity-${index + 1}`,
      ...amenity,
    })),
    tips: guide.tips.map((tip, index) => ({
      id: `${iata.toLowerCase()}-tip-${index + 1}`,
      ...tip,
    })),
    transport: guide.transport,
    disruption: {
      ...guide.disruption,
      alerts: guide.disruption.alerts ?? [],
      lastUpdated: new Date().toISOString(),
    },
  };
}
