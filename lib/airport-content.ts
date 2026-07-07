/**
 * Next-facing airport guide reads, backed by Postgres.
 *
 * Every read goes through Next's data cache tagged `airport-guides`, so
 * rendered pages stay static-fast and the content pipeline publishes updates
 * by upserting a row and revalidating the tag — no rebuild, no redeploy.
 *
 * Domain types, parsing, validation, and writes live in `lib/airport-guides.ts`.
 */
import { unstable_cache } from "next/cache";
import {
  fetchAirportGuideRow,
  fetchAllAirportGuideRows,
  getAirportGuideSummary,
  rowToAirportContent,
  rowToAirportSummary,
  type AirportContent,
  type AirportGuideSummary,
  type AirportSummary,
} from "./airport-guides";

export type {
  AirportBentoTip,
  AirportContent,
  AirportFrontmatter,
  AirportGuideSection,
  AirportGuideSections,
  AirportGuideSummary,
  AirportLounge,
  AirportLoungeVerdict,
  AirportSummary,
} from "./airport-guides";

export { getAirportGuideSummary } from "./airport-guides";

export const AIRPORT_GUIDES_CACHE_TAG = "airport-guides";

const getCachedAirportGuideRow = unstable_cache(
  async (iata: string) => fetchAirportGuideRow(iata),
  ["airport-guide-by-iata"],
  { tags: [AIRPORT_GUIDES_CACHE_TAG] },
);

const getCachedAirportGuideRows = unstable_cache(
  async () => fetchAllAirportGuideRows(),
  ["airport-guides-all"],
  { tags: [AIRPORT_GUIDES_CACHE_TAG] },
);

export async function getAirportContent(iata: string): Promise<AirportContent | null> {
  const row = await getCachedAirportGuideRow(iata.toUpperCase());
  return row ? rowToAirportContent(row) : null;
}

export async function getAirportGuideSummaryByIata(
  iata: string,
): Promise<AirportGuideSummary | null> {
  const content = await getAirportContent(iata);
  return content ? getAirportGuideSummary(content) : null;
}

export async function getAllAirportIatas(): Promise<string[]> {
  const rows = await getCachedAirportGuideRows();
  return rows.map((row) => row.iata.toUpperCase()).sort();
}

export async function getAllAirports(): Promise<AirportSummary[]> {
  const rows = await getCachedAirportGuideRows();
  return rows
    .map(rowToAirportSummary)
    .sort((a, b) => a.name.localeCompare(b.name));
}
