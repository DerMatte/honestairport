/**
 * Next-facing airport guide reads, backed by Postgres.
 *
 * Every read goes through Next's data cache tagged `airport-guides`, so
 * rendered pages stay static-fast and the content pipeline publishes updates
 * by upserting a row and revalidating the tag — no rebuild, no redeploy.
 *
 * Domain types, parsing, validation, and writes live in `lib/airport-guides.ts`.
 */
import { cacheLife, cacheTag } from "next/cache";
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
import {
  fetchAirportImageRows,
  rowToAirportImage,
  type AirportImage,
} from "./airport-images";
import {
  fetchAirportGoogleRatingRow,
  rowToAirportGoogleRating,
  type AirportGoogleRating,
} from "./google-ratings";

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
export type { AirportImage } from "./airport-images";
export type { AirportGoogleRating } from "./google-ratings";

export const AIRPORT_GUIDES_CACHE_TAG = "airport-guides";
export const AIRPORT_IMAGES_CACHE_TAG = "airport-images";
export const AIRPORT_GOOGLE_RATINGS_CACHE_TAG = "airport-google-ratings";

function airportContentCacheLife() {
  cacheLife({ stale: 300, revalidate: 300, expire: 60 * 60 * 24 });
}

export async function getAirportImages(iata: string): Promise<AirportImage[]> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_IMAGES_CACHE_TAG);

  const rows = await fetchAirportImageRows(iata.toUpperCase());
  return rows.map(rowToAirportImage);
}

export async function getAirportGoogleRating(
  iata: string,
): Promise<AirportGoogleRating | null> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_GOOGLE_RATINGS_CACHE_TAG);

  const row = await fetchAirportGoogleRatingRow(iata.toUpperCase());
  return row ? rowToAirportGoogleRating(row) : null;
}

export async function getAirportContent(iata: string): Promise<AirportContent | null> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_GUIDES_CACHE_TAG);

  const row = await fetchAirportGuideRow(iata.toUpperCase());
  return row ? rowToAirportContent(row) : null;
}

export async function getAirportGuideSummaryByIata(
  iata: string,
): Promise<AirportGuideSummary | null> {
  const content = await getAirportContent(iata);
  return content ? getAirportGuideSummary(content) : null;
}

export async function getAllAirportIatas(): Promise<string[]> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_GUIDES_CACHE_TAG);

  const rows = await fetchAllAirportGuideRows();
  return rows.map((row) => row.iata.toUpperCase()).sort();
}

export async function getAllAirports(): Promise<AirportSummary[]> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_GUIDES_CACHE_TAG);

  const rows = await fetchAllAirportGuideRows();
  return rows
    .map(rowToAirportSummary)
    .sort((a, b) => a.name.localeCompare(b.name));
}
