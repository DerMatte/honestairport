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
import {
  fetchAllAirportGuideRows,
  upsertAirportGuide,
} from "../lib/airport-guides";
import { fetchAllAirportProfileRows, upsertAirportProfile } from "../lib/airport-profiles";
import { getMajorAirportCandidates } from "../lib/major-airports";
import {
  buildProfileInput,
  buildResearchPrompt,
  guideJsonSchema,
  toAirportContent,
  type GuideJson,
} from "./airport-research-shared";
import {
  extractJsonCandidates,
  runGrokHeadless,
  type GrokHeadlessResult,
} from "./grok-headless";
import { loadLocalEnv } from "./load-env";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

const LOG_FILE = path.join(process.cwd(), "scripts/.generate-airports-grok.log");

// The output schema, research prompt, and JSON -> guide/profile converters
// live in `scripts/airport-research-shared.ts`, shared with the AI Gateway
// batch rebuild script so both research pipelines stay in lockstep.

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
