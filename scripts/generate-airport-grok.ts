#!/usr/bin/env tsx
/**
 * Airport guide + Airportist Score generator powered by the local `grok` CLI
 * (Grok Build free tokens) instead of the paid AI Gateway. Runs grok
 * headlessly with web search enabled so each guide and score is actually
 * researched (official airport sites, vielfliegertreff.de, FlyerTalk,
 * Reddit, delay/on-time data) before being written.
 *
 * The model outputs a single structured JSON object (no markdown document)
 * covering both the markdown guide content and the Airportist Score profile
 * (amenities, tips, transport, disruption snapshot). It's validated with zod
 * and pushed into Postgres via `upsertAirportGuide` (validation + revision
 * snapshot + upsert) and `upsertAirportProfile`. icao/lat/lon/region are
 * looked up from local reference data instead of asked of the model.
 *
 * Usage:
 *   pnpm generate:airport:grok LHR                # one specific airport (guide + score)
 *   pnpm generate:airport:grok CDG "focus on transfers"
 *   pnpm generate:airport:grok --next             # next missing guide, then next
 *                                                 # unscored airport, then the stalest guide
 *   pnpm generate:airport:grok --next --dry-run   # show what --next would pick
 *
 * Designed for one-by-one background runs on the VPS (see cron entry using
 * flock so runs never overlap) — this is how every airport gets both a guide
 * and an Airportist Score over time, not just the original 10.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  fetchAllAirportGuideRows,
  upsertAirportGuide,
  type AirportContent,
} from "../lib/airport-guides";
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
  fetchAllAirportProfileRows,
  regionForCountryCode,
  upsertAirportProfile,
  type AirportProfileInput,
} from "../lib/airport-profiles";
import { getAirportByIata } from "../lib/airports";
import { getMajorAirportCandidates } from "../lib/major-airports";
import {
  extractJsonCandidates,
  runGrokHeadless,
  type GrokHeadlessResult,
} from "./grok-headless";
import { loadLocalEnv } from "./load-env";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

const LOG_FILE = path.join(process.cwd(), "scripts/.generate-airports-grok.log");

// --- Model output schema --------------------------------------------------------
//
// Grok's JSON occasionally drifts slightly outside the shape asked for in the
// prompt (an empty "hours": "" instead of omitting the key, one lounge or
// trick over the cap). Rather than failing the whole run over that, treat it
// as recoverable: blank optional strings become undefined, and over-long
// lists get truncated to the max instead of rejected. The primitives and all
// Airportist Score profile shapes live in `lib/airport-profile-schema.ts`,
// shared with the on-demand web generator so both pipelines agree on what a
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
  });

// --- Airportist Score profile fields ---------------------------------------------
//
// Same research pass also produces the scoring profile (airport_profiles
// table): Airportist Score, amenities, tips, transport options, and a
// disruption snapshot — field shapes imported from
// `lib/airport-profile-schema.ts`. icao/latitude/longitude/region are never
// asked of the model — they're looked up deterministically (see
// `buildProfileInput`) to avoid hallucinated geo/classification data.

const guideJsonSchema = z.object({
  iata: z.string().regex(/^[A-Z]{3}$/),
  name: nonEmpty,
  city: nonEmpty,
  country: nonEmpty,
  summary: nonEmpty.describe("One-sentence high-signal summary"),
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

type GuideJson = z.infer<typeof guideJsonSchema>;

// --- Prompt ---------------------------------------------------------------------

function buildResearchPrompt(iata: string, extraInstructions = ""): string {
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
      "terminal": "Terminal 2",
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
    { "label": "Short label", "category": "food|lounge|wifi|family|accessibility|transport|shopping|sleep", "description": "One sentence, specific to this airport.", "quality": "basic|good|excellent", "isFeatured": true }
  ],
  "tips": [
    { "category": "security|food|navigation|layover|transport|family|lounge", "title": "Short imperative headline", "summary": "One actionable sentence.", "details": "1-2 sentences of specific context.", "pro": "optional upside", "con": "optional downside" }
  ],
  "transport": [
    { "type": "train|metro|bus|taxi|rideshare|parking", "name": "Service name", "summary": "One sentence.", "timeToCity": "35-45 min", "cost": "$ | $$ | $$$", "insiderTip": "One specific, actionable sentence.", "bestFor": ["fastest", "cheapest", "luggage"] }
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
- 2-6 waterOptions covering the cheapest bottle purchase, at least one refill or free option, with exactly one isBestValue and at most one isBestQuality. Include real prices for purchase options when you find them.
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

// --- Grok CLI invocation ----------------------------------------------------------

function extractGuideJson(result: GrokHeadlessResult): GuideJson {
  const candidates = extractJsonCandidates(result);

  for (const candidate of candidates) {
    const parsed = guideJsonSchema.safeParse(candidate);
    if (parsed.success) {
      return parsed.data;
    }
  }

  const firstCandidate = candidates[0];
  const detail =
    firstCandidate !== undefined
      ? guideJsonSchema
          .safeParse(firstCandidate)
          .error?.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")
      : "no JSON object found in grok response";

  throw new Error(`grok output failed schema validation: ${detail}`);
}

// --- JSON -> AirportContent -------------------------------------------------------

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function toAirportContent(guide: GuideJson): AirportContent {
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
    return `${option.name}, ${option.terminal}${zone}${price}: ${option.summary}`;
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
function buildProfileInput(iata: string, guide: GuideJson): AirportProfileInput {
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

// --- Main flow --------------------------------------------------------------------

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n").catch(() => {});
}

export async function generateAirportGuideWithGrok(iata: string, extraInstructions = "") {
  const normalizedIata = iata.toUpperCase();
  const startedAt = Date.now();

  await logLine(`Researching ${normalizedIata} with grok CLI…`);

  const result = await runGrokHeadless(buildResearchPrompt(normalizedIata, extraInstructions));
  const guide = extractGuideJson(result);

  if (guide.iata !== normalizedIata) {
    throw new Error(`grok returned guide for ${guide.iata}, expected ${normalizedIata}`);
  }

  const row = await upsertAirportGuide(toAirportContent(guide));
  const profileRow = await upsertAirportProfile(normalizedIata, buildProfileInput(normalizedIata, guide));
  await requestSiteRevalidation();

  const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
  await logLine(
    `✅ ${row.iata} guide + Airportist Score ${profileRow.airportistScore} written to Postgres ` +
      `(${guide.lounges.length} lounges, ${guide.sources.length} sources, ${minutes} min)`,
  );

  return row.iata;
}

interface NextTarget {
  iata: string;
  reason: string;
}

/**
 * Next airport to work on, in priority order:
 *  1. Any major airport still missing a guide (by traffic rank).
 *  2. Any major airport with a guide but no Airportist Score yet — rate the
 *     whole catalog one by one, highest-traffic first.
 *  3. Any other guide still missing a score (stalest first) — catches
 *     airports whose guide was generated on demand by a visitor before the
 *     scoring step ran (or where it failed), so nothing stays an
 *     editorial-only page forever.
 *  4. Once everything is both guided and scored, refresh the guide (and its
 *     score) with the oldest `lastUpdated` so the catalog keeps improving
 *     indefinitely.
 */
async function pickNextTarget(): Promise<NextTarget | null> {
  const [guideRows, profileRows] = await Promise.all([
    fetchAllAirportGuideRows(),
    fetchAllAirportProfileRows(),
  ]);
  const existingGuides = new Set(guideRows.map((row) => row.iata.toUpperCase()));
  const existingProfiles = new Set(profileRows.map((row) => row.iata.toUpperCase()));

  for (const candidate of getMajorAirportCandidates()) {
    if (!existingGuides.has(candidate.iata)) {
      return {
        iata: candidate.iata,
        reason: `missing major airport #${candidate.rank} (${candidate.name})`,
      };
    }
  }

  for (const candidate of getMajorAirportCandidates()) {
    if (!existingProfiles.has(candidate.iata)) {
      return {
        iata: candidate.iata,
        reason: `missing Airportist Score for #${candidate.rank} (${candidate.name})`,
      };
    }
  }

  const unscored = [...guideRows]
    .filter((row) => !existingProfiles.has(row.iata.toUpperCase()))
    .sort((a, b) => a.lastUpdated.localeCompare(b.lastUpdated))[0];
  if (unscored) {
    return {
      iata: unscored.iata.toUpperCase(),
      reason: `guide without Airportist Score (lastUpdated ${unscored.lastUpdated})`,
    };
  }

  const stalest = [...guideRows].sort((a, b) => a.lastUpdated.localeCompare(b.lastUpdated))[0];
  if (!stalest) {
    return null;
  }

  return {
    iata: stalest.iata.toUpperCase(),
    reason: `stalest guide (lastUpdated ${stalest.lastUpdated})`,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const useNext = args.includes("--next");
  const positional = args.filter((arg) => !arg.startsWith("--"));

  if (useNext) {
    const target = await pickNextTarget();
    if (!target) {
      console.log("No airports to generate or refresh. Nothing to do.");
      return;
    }
    if (dryRun) {
      console.log(`Next up: ${target.iata} — ${target.reason}`);
      return;
    }
    await logLine(`--next picked ${target.iata}: ${target.reason}`);
    await generateAirportGuideWithGrok(target.iata);
    return;
  }

  const iata = positional[0];
  if (!iata) {
    console.error("Usage: pnpm generate:airport:grok <IATA> [extra instructions] | --next [--dry-run]");
    process.exit(1);
  }

  await generateAirportGuideWithGrok(iata, positional.slice(1).join(" "));
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await logLine(`❌ Failed: ${message}`);
  process.exit(1);
});
