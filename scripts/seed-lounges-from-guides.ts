#!/usr/bin/env tsx
/**
 * One-off backfill: copy every guide's jsonb `lounges` into the
 * `airport_lounges` directory as unverified seed rows (lastVerified NULL), so
 * lounge subpages exist immediately and `pnpm sync:lounges` has rows to
 * verify. Idempotent — an airport that already has any directory rows is
 * skipped, so re-running never clobbers enriched data.
 *
 * Usage:
 *   pnpm seed:lounges [--dry-run]
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fetchAllAirportGuideRows } from "../lib/airport-guides";
import { fetchAllAirportLoungeRows, seedLoungesFromGuide } from "../lib/lounge-directory";
import { loadLocalEnv } from "./load-env";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

const LOG_FILE = path.join(process.cwd(), "scripts/.seed-lounges.log");

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n").catch(() => {});
}

async function main() {
  const dryRun = process.argv.slice(2).includes("--dry-run");

  const [guideRows, loungeRows] = await Promise.all([
    fetchAllAirportGuideRows(),
    fetchAllAirportLoungeRows(),
  ]);
  const seeded = new Set(loungeRows.map((row) => row.iata.toUpperCase()));

  const candidates = guideRows
    .filter((row) => row.lounges.length > 0 && !seeded.has(row.iata.toUpperCase()))
    .sort((a, b) => a.iata.localeCompare(b.iata));

  if (candidates.length === 0) {
    console.log("Every guide with lounges already has directory rows. Nothing to do.");
    return;
  }

  if (dryRun) {
    for (const row of candidates) {
      console.log(`Would seed ${row.iata}: ${row.lounges.length} lounges`);
    }
    console.log(`Total: ${candidates.length} airports`);
    return;
  }

  let airports = 0;
  let lounges = 0;
  for (const row of candidates) {
    const inserted = await seedLoungesFromGuide(row);
    if (inserted > 0) {
      airports += 1;
      lounges += inserted;
      await logLine(`Seeded ${row.iata}: ${inserted} lounges`);
    }
  }

  await requestSiteRevalidation();
  await logLine(`✅ Seeded ${lounges} lounges across ${airports} airports`);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  await logLine(`❌ Failed: ${message}`);
  process.exit(1);
});
