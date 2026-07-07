#!/usr/bin/env tsx
/**
 * Airport guide generator powered by the local `grok` CLI (Grok Build free
 * tokens) instead of the paid AI Gateway. Runs grok headlessly with web
 * search enabled so each guide is actually researched (official airport
 * sites, vielfliegertreff.de, FlyerTalk, Reddit) before being written.
 *
 * The model outputs structured JSON (no markdown document), which is
 * validated with zod and pushed directly into Postgres via the existing
 * `upsertAirportGuide` pipeline (validation + revision snapshot + upsert).
 *
 * Usage:
 *   pnpm generate:airport:grok LHR                # one specific airport
 *   pnpm generate:airport:grok CDG "focus on transfers"
 *   pnpm generate:airport:grok --next             # next missing major airport,
 *                                                 # or the stalest guide once all exist
 *   pnpm generate:airport:grok --next --dry-run   # show what --next would pick
 *
 * Designed for one-by-one background runs on the VPS (see cron entry using
 * flock so runs never overlap).
 */

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  fetchAllAirportGuideRows,
  upsertAirportGuide,
  type AirportContent,
} from "../lib/airport-guides";
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

const nonEmpty = z.string().trim().min(1);

const guideJsonSchema = z.object({
  iata: z.string().regex(/^[A-Z]{3}$/),
  name: nonEmpty,
  city: nonEmpty,
  country: nonEmpty,
  summary: nonEmpty.describe("One-sentence high-signal summary"),
  sources: z.array(z.url()).min(3),
  quickFacts: z.array(nonEmpty).min(4).max(6),
  bentoTips: z
    .array(
      z.object({
        category: z.enum(["timing", "terminal", "food", "status"]),
        label: nonEmpty,
        title: nonEmpty,
        summary: nonEmpty,
        detail: nonEmpty.optional(),
      }),
    )
    .length(4)
    .refine(
      (tips) => new Set(tips.map((tip) => tip.category)).size === 4,
      "bentoTips must cover all four categories exactly once",
    ),
  lounges: z
    .array(
      z.object({
        name: nonEmpty,
        terminal: nonEmpty,
        zone: nonEmpty.optional(),
        access: z.array(nonEmpty).min(1),
        hours: nonEmpty.optional(),
        amenities: z.array(nonEmpty).optional(),
        bestFor: z.array(nonEmpty).optional(),
        verdict: z.enum(["worth-it", "depends", "skip"]),
        summary: nonEmpty,
      }),
    )
    .min(2)
    .max(6),
  securityTips: z.array(nonEmpty).min(3).max(8),
  airportTricks: z.array(nonEmpty).min(5).max(8),
  terminalNavigation: z.array(nonEmpty).min(3).max(8),
  loungesAmenities: z.array(nonEmpty).min(3).max(8),
  groundTransport: z.array(nonEmpty).min(3).max(8),
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
  "securityTips": ["3-8 actionable security/screening tips specific to this airport (fast-track options, known pain points, times of day to avoid)"],
  "airportTricks": ["5-8 genuinely clever tricks experienced travelers actually use here — be specific, include context like 'works best when...' or 'avoid if...'"],
  "terminalNavigation": ["3-8 items: walking times, best connections, common mistakes"],
  "loungesAmenities": ["3-8 items: honest picks for lounges, standout food, quiet spots"],
  "groundTransport": ["3-8 items: best ways in/out, current costs, insider timing tips"]
}

Rules:
- Exactly 4 bentoTips, one per category, in the order timing, terminal, food, status. These are shown prominently — no generic advice.
- 2-6 lounges covering the most relevant options for ordinary travelers (Priority Pass / independent lounges plus flagship airline lounges).
- Tone: direct, slightly opinionated, zero fluff. Prioritize traveler time-saving and stress reduction.
- All facts must come from your research, not memory alone.
- Do not create or modify any files. Your only deliverable is the JSON response.
${extraInstructions ? `- Additional focus: ${extraInstructions}` : ""}

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
    },
    content,
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
  await requestSiteRevalidation();

  const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
  await logLine(`✅ ${row.iata} guide written to Postgres (${guide.lounges.length} lounges, ${guide.sources.length} sources, ${minutes} min)`);

  return row.iata;
}

interface NextTarget {
  iata: string;
  reason: string;
}

/**
 * Next airport to work on: any major airport still missing a guide comes
 * first (by traffic rank); once all exist, refresh the guide with the oldest
 * `lastUpdated` so the whole catalog keeps improving one by one.
 */
async function pickNextTarget(): Promise<NextTarget | null> {
  const rows = await fetchAllAirportGuideRows();
  const existing = new Set(rows.map((row) => row.iata.toUpperCase()));

  for (const candidate of getMajorAirportCandidates()) {
    if (!existing.has(candidate.iata)) {
      return {
        iata: candidate.iata,
        reason: `missing major airport #${candidate.rank} (${candidate.name})`,
      };
    }
  }

  const stalest = [...rows].sort((a, b) => a.lastUpdated.localeCompare(b.lastUpdated))[0];
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
