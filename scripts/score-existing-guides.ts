#!/usr/bin/env tsx
/**
 * Convert guide-only airports into scored ("normal") airports by writing an
 * Airportist Score profile from the existing guide markdown. Does not rewrite
 * the guide or touch lastUpdated.
 *
 * Usage:
 *   pnpm score:guides --dry-run
 *   pnpm score:guides --all [--limit N]
 *   pnpm score:guides LHR
 *   pnpm score:guides --next
 *
 * Provider: AI Gateway when AI_GATEWAY_API_KEY is set, otherwise local grok CLI.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  airportContentToMarkdown,
  fetchAirportGuideRow,
  fetchAllAirportGuideRows,
  rowToAirportContent,
} from "../lib/airport-guides";
import { airportScoreProfileSchema } from "../lib/airport-profile-schema";
import { fetchAllAirportProfileRows, upsertAirportProfile } from "../lib/airport-profiles";
import { getAirportByIata } from "../lib/airports";
import {
  buildAirportScorePrompt,
  generateAirportScoreProfile,
  profileInputFromScore,
} from "../lib/generate-airport-profile";
import { extractJsonCandidates, runGrokHeadless } from "./grok-headless";
import { loadLocalEnv } from "./load-env";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

const LOG_FILE = path.join(process.cwd(), "scripts/.score-existing-guides.log");

async function listUnscoredGuideIatas(): Promise<string[]> {
  const [guideRows, profileRows] = await Promise.all([
    fetchAllAirportGuideRows(),
    fetchAllAirportProfileRows(),
  ]);
  const scored = new Set(profileRows.map((row) => row.iata.toUpperCase()));
  return guideRows
    .map((row) => row.iata.toUpperCase())
    .filter((iata) => !scored.has(iata))
    .sort((a, b) => a.localeCompare(b));
}

async function generateScoreWithGrok(
  iata: string,
  record: NonNullable<ReturnType<typeof getAirportByIata>>,
  guideMarkdown: string,
) {
  const prompt = `${buildAirportScorePrompt(iata, record, guideMarkdown)}

Respond with a single JSON object only (no markdown fences) that matches this shape:
{
  "shortName": string,
  "region": "North America" | "Europe" | "Asia-Pacific" | "Middle East" | "South America" | "Africa",
  "summary": string,
  "airportistScore": number,
  "scoreBreakdown": { "comfort", "navigation", "food", "transport", "disruptionResilience" },
  "stats": { "annualPassengers", "terminals", "onTimePercentage", "averageSecurityMinutes" },
  "bestFor": string[],
  "watchOutFor": string[],
  "amenities": [{ "label", "category", "description", "quality", "isFeatured?" }],
  "tips": [{ "category", "title", "summary", "details", "pro?", "con?" }],
  "transport": [{ "type", "name", "summary", "timeToCity", "cost", "insiderTip", "bestFor?" }],
  "disruption": { "status", "departureDelayMinutes", "departureDelayPercent", "arrivalDelayMinutes", "arrivalDelayPercent", "cancellationsPercent", "alerts?" }
}`;

  const result = await runGrokHeadless(prompt);
  const candidates = extractJsonCandidates(result);

  for (const candidate of candidates) {
    const parsed = airportScoreProfileSchema.safeParse(candidate);
    if (parsed.success) {
      return profileInputFromScore(iata, record, parsed.data);
    }
  }

  const first = candidates[0];
  const detail =
    first !== undefined
      ? airportScoreProfileSchema
          .safeParse(first)
          .error?.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")
      : "no JSON object found in grok response";
  throw new Error(`grok score output failed schema validation: ${detail}`);
}

export async function scoreExistingGuide(iata: string): Promise<number> {
  const normalized = iata.trim().toUpperCase();
  const record = getAirportByIata(normalized);
  if (!record) {
    throw new Error(`No reference airport record for ${normalized}`);
  }

  const row = await fetchAirportGuideRow(normalized);
  if (!row) {
    throw new Error(`No guide for ${normalized} — generate a guide first`);
  }

  const guideMarkdown = airportContentToMarkdown(rowToAirportContent(row));
  const useGateway = Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
  const input = useGateway
    ? await generateAirportScoreProfile(normalized, record, guideMarkdown)
    : await generateScoreWithGrok(normalized, record, guideMarkdown);

  const profile = await upsertAirportProfile(normalized, input);
  await requestSiteRevalidation();
  return profile.airportistScore;
}

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n").catch(() => {});
}

function parseArgs() {
  const args = process.argv.slice(2);
  const positional = args.filter((arg) => !arg.startsWith("--"));
  let limit = Number.POSITIVE_INFINITY;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--limit" && args[i + 1]) {
      limit = Math.max(1, Number.parseInt(args[++i], 10) || 1);
    }
  }

  return {
    dryRun: args.includes("--dry-run"),
    all: args.includes("--all"),
    next: args.includes("--next"),
    limit,
    iata: positional[0]?.toUpperCase() ?? null,
  };
}

async function main() {
  const options = parseArgs();
  const unscored = await listUnscoredGuideIatas();

  if (options.dryRun && !options.iata) {
    const shown = unscored.slice(0, Number.isFinite(options.limit) ? options.limit : unscored.length);
    console.log(
      `${unscored.length} guide-only airport${unscored.length === 1 ? "" : "s"} need a score` +
        (shown.length ? `:\n  ${shown.join("\n  ")}` : "."),
    );
    if (unscored.length > shown.length) {
      console.log(`  …and ${unscored.length - shown.length} more`);
    }
    return;
  }

  if (options.iata) {
    if (options.dryRun) {
      console.log(`Would score ${options.iata} from its existing guide.`);
      return;
    }
    await logLine(`Scoring ${options.iata} from existing guide…`);
    const score = await scoreExistingGuide(options.iata);
    await logLine(`✅ ${options.iata} Airportist Score ${score}`);
    return;
  }

  if (!options.all && !options.next) {
    console.error("Usage: pnpm score:guides --all [--limit N] | --next | <IATA> [--dry-run]");
    process.exit(1);
  }

  const queue = options.next ? unscored.slice(0, 1) : unscored.slice(0, options.limit);
  if (queue.length === 0) {
    console.log("No guide-only airports left to score.");
    return;
  }

  let failed = 0;
  for (const [index, iata] of queue.entries()) {
    await logLine(`(${index + 1}/${queue.length}) Scoring ${iata} from existing guide…`);
    try {
      const score = await scoreExistingGuide(iata);
      await logLine(`✅ ${iata} Airportist Score ${score}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await logLine(`❌ ${iata}: ${message}`);
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main().catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    await logLine(`❌ Failed: ${message}`);
    process.exit(1);
  });
}
