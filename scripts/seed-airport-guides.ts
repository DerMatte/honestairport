#!/usr/bin/env tsx
/**
 * One-time import of content/airports/*.md into the airport_guides table.
 *
 * Idempotent: re-running upserts every file again (each overwrite snapshots
 * the previous row into airport_guide_revisions).
 *
 * Usage:
 *   pnpm db:seed
 */
import fs from "node:fs/promises";
import path from "node:path";
import { parseAirportGuideMarkdown, upsertAirportGuide } from "../lib/airport-guides";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const CONTENT_DIR = path.join(process.cwd(), "content/airports");

async function main() {
  const files = (await fs.readdir(CONTENT_DIR)).filter((f) => f.endsWith(".md")).sort();

  if (files.length === 0) {
    console.error(`No guides found in ${CONTENT_DIR}`);
    process.exit(1);
  }

  let succeeded = 0;
  const failures: string[] = [];

  for (const file of files) {
    const markdown = await fs.readFile(path.join(CONTENT_DIR, file), "utf8");
    try {
      const row = await upsertAirportGuide(parseAirportGuideMarkdown(markdown));
      succeeded += 1;
      console.log(`✓ ${row.iata}`);
    } catch (error) {
      failures.push(`${file}: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${files.length} guides failed to import:`);
    for (const failure of failures) {
      console.error(`  ✗ ${failure}`);
    }
    process.exit(1);
  }

  console.log(`\nSeeded ${succeeded} airport guides into Postgres.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
