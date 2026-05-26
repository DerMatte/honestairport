#!/usr/bin/env tsx
/**
 * Batch-generate airport guide pages, starting with the world's busiest hubs.
 *
 * Usage:
 *   pnpm generate:airports              # next 15 missing major airports
 *   pnpm generate:airports --limit 5    # generate up to 5
 *   pnpm generate:airports --dry-run    # list what would be generated
 *   pnpm generate:airports --from-rank 10 # skip ranks 1-9
 *
 * Logs progress to scripts/.generate-airports-batch.log
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getMajorAirportCandidates } from "../lib/major-airports";
import {
  airportContentExists,
  generateAirportPage,
} from "./generate-airport";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const LOG_FILE = path.join(process.cwd(), "scripts/.generate-airports-batch.log");
const DEFAULT_LIMIT = 15;
const DELAY_MS = 3_000;

interface BatchOptions {
  limit: number;
  fromRank: number;
  dryRun: boolean;
}

function parseArgs(): BatchOptions {
  const args = process.argv.slice(2);
  let limit = DEFAULT_LIMIT;
  let fromRank = 1;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--limit" && args[i + 1]) {
      limit = Math.max(1, Number.parseInt(args[++i], 10) || DEFAULT_LIMIT);
    } else if (arg === "--from-rank" && args[i + 1]) {
      fromRank = Math.max(1, Number.parseInt(args[++i], 10) || 1);
    }
  }

  return { limit, fromRank, dryRun };
}

function requireApiKey(): string {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey?.trim()) {
    console.error("Missing AI_GATEWAY_API_KEY. Add it to .env.local or export it in your shell.");
    process.exit(1);
  }
  return apiKey;
}

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function selectCandidates(options: BatchOptions) {
  const candidates = getMajorAirportCandidates().filter((airport) => airport.rank >= options.fromRank);
  const selected = [];

  for (const airport of candidates) {
    if (selected.length >= options.limit) break;
    if (await airportContentExists(airport.iata)) continue;
    selected.push(airport);
  }

  return selected;
}

async function runBatch() {
  const options = parseArgs();
  requireApiKey();

  const selected = await selectCandidates(options);

  if (selected.length === 0) {
    console.log("No missing major airports to generate in this batch.");
    return;
  }

  await logLine(
    `Batch start: ${selected.length} airport(s)${options.dryRun ? " (dry run)" : ""} — ${selected.map((a) => `#${a.rank} ${a.iata}`).join(", ")}`,
  );

  if (options.dryRun) {
    for (const airport of selected) {
      console.log(`  #${airport.rank} ${airport.iata} — ${airport.name} (${airport.city}, ${airport.country})`);
    }
    return;
  }

  let succeeded = 0;
  let failed = 0;

  for (const [index, airport] of selected.entries()) {
    try {
      await logLine(`Generating #${airport.rank} ${airport.iata} (${airport.name})…`);
      await generateAirportPage(airport.iata);
      succeeded++;
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : String(error);
      await logLine(`Failed #${airport.rank} ${airport.iata}: ${message}`);
    }

    if (index < selected.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  await logLine(`Batch complete: ${succeeded} succeeded, ${failed} failed.`);
}

runBatch().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await fs.appendFile(LOG_FILE, `[${new Date().toISOString()}] Fatal: ${message}\n`).catch(() => {});
  console.error(error);
  process.exit(1);
});
