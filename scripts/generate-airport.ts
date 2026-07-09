#!/usr/bin/env tsx
/**
 * AI SDK-powered Airport Page Generator (using Grok 4.3 via Vercel AI Gateway)
 *
 * Usage:
 *   AI_GATEWAY_API_KEY=xxx pnpm generate:airport LHR
 *   AI_GATEWAY_API_KEY=xxx pnpm generate:airport CDG "Focus on family travel and long-haul connections"
 *
 * IMPORTANT: Always review and fact-check the output before committing.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAirportGuideStream } from "../lib/generate-airport-guide";
import {
  airportGuideExists,
  parseAirportGuideMarkdown,
  upsertAirportGuide,
} from "../lib/airport-guides";
import { getAirportByIata } from "../lib/airports";
import { loadLocalEnv } from "./load-env";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

export { buildAirportGenerationPrompt } from "../lib/generate-airport-guide";

export { airportGuideExists as airportContentExists };

export async function generateAirportPage(iata: string, extraInstructions = "") {
  const normalizedIata = iata.toUpperCase();
  const record = getAirportByIata(normalizedIata);
  const result = createAirportGuideStream(normalizedIata, record, extraInstructions);
  const text = await result.text;

  // Validates the guide and snapshots any previous version before writing.
  const row = await upsertAirportGuide(parseAirportGuideMarkdown(text.trim()));
  await requestSiteRevalidation();

  console.log(`✅ Generated guide for ${row.iata} (stored in Postgres)`);

  return row.iata;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const iata = process.argv[2];
  const extra = process.argv.slice(3).join(" ");

  if (!iata) {
    console.error("Usage: pnpm generate:airport <IATA> [extra instructions]");
    process.exit(1);
  }

  generateAirportPage(iata, extra).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
