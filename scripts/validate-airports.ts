#!/usr/bin/env tsx
/**
 * Validate every airport guide stored in Postgres.
 *
 * Writes already validate at save time (see upsertAirportGuide); this catches
 * rows edited out-of-band (manual SQL, migrations) before they ship. Runs as
 * part of `pnpm build`; any error fails the build.
 *
 * Usage:
 *   pnpm validate:content
 */
import {
  fetchAllAirportGuideRows,
  rowToAirportContent,
  validateAirportGuide,
} from "../lib/airport-guides";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const rows = await fetchAllAirportGuideRows();

  if (rows.length === 0) {
    console.error("No airport guides found in the database (is DATABASE_URL set and seeded?).");
    process.exit(1);
  }

  let failed = 0;
  for (const row of rows.sort((a, b) => a.iata.localeCompare(b.iata))) {
    const errors = validateAirportGuide(rowToAirportContent(row));
    if (errors.length > 0) {
      failed += 1;
      console.error(`✗ ${row.iata}`);
      for (const error of errors) {
        console.error(`    ${error}`);
      }
    }
  }

  if (failed > 0) {
    console.error(`\n${failed} of ${rows.length} guides failed validation.`);
    process.exit(1);
  }

  console.log(`✓ All ${rows.length} airport guides are valid.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
