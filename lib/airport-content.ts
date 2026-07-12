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
import { fetchAirportByIata, fetchAllAirports } from "./airport-profiles";
import {
  fetchAirportGoogleRatingRow,
  rowToAirportGoogleRating,
  type AirportGoogleRating,
} from "./google-ratings";
import {
  fetchAirportLoungeRow,
  fetchAirportLoungeRows,
  fetchAllAirportLoungeRows,
  guideLoungeToView,
  loungeRowToView,
  type AirportLoungeView,
} from "./lounge-directory";
import { fetchLoungeImageRows, loungeImageRowToAirportImage } from "./lounge-images";
import { getEditorialReviewsByIata } from "./reviews";
import type { AirportUserReview } from "./review-schema";
import type { Airport } from "./types";

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
  AirportWaterOption,
  AirportWaterOptionKind,
} from "./airport-guides";

export {
  filterWaterRelatedGuideItems,
  getAirportGuideSummary,
  isWaterRelatedGuideItem,
} from "./airport-guides";
export type { AirportImage } from "./airport-images";
export type { AirportGoogleRating } from "./google-ratings";
export type { AirportLoungeView, LoungeAccessMethod } from "./lounge-directory";
export { PROGRAM_LABELS } from "./lounge-directory";

export const AIRPORT_GUIDES_CACHE_TAG = "airport-guides";
export const AIRPORT_IMAGES_CACHE_TAG = "airport-images";
export const AIRPORT_GOOGLE_RATINGS_CACHE_TAG = "airport-google-ratings";
export const AIRPORT_PROFILES_CACHE_TAG = "airport-profiles";
export const AIRPORT_LOUNGES_CACHE_TAG = "airport-lounges";

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

/** Full Airportist Score profile for a scored airport, joined against its guide row. */
export async function getAirportProfile(iata: string): Promise<Airport | null> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_GUIDES_CACHE_TAG);
  cacheTag(AIRPORT_PROFILES_CACHE_TAG);

  return fetchAirportByIata(iata);
}

export async function getAllAirportProfiles(): Promise<Airport[]> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_GUIDES_CACHE_TAG);
  cacheTag(AIRPORT_PROFILES_CACHE_TAG);

  return fetchAllAirports();
}

/** Airportist Score directory: every scored airport, sorted highest score first. */
export async function getAllHonestAirports(): Promise<Airport[]> {
  const profiles = await getAllAirportProfiles();
  return [...profiles].sort((a, b) => b.airportistScore - a.airportistScore);
}

export async function getAirportBySlug(slug: string): Promise<Airport | null> {
  return getAirportProfile(slug.trim().toUpperCase());
}

export async function getAirportSlugs(): Promise<string[]> {
  const profiles = await getAllAirportProfiles();
  return profiles.map((airport) => airport.slug);
}

/** Rights-cleared photos for one lounge; empty for most lounges (normal). */
export async function getAirportLoungeImages(
  iata: string,
  loungeSlug: string,
): Promise<AirportImage[]> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_IMAGES_CACHE_TAG);

  const rows = await fetchLoungeImageRows(iata.toUpperCase(), loungeSlug);
  return rows.map(loungeImageRowToAirportImage);
}

/** Directory lounges for an airport; closed ones are kept out of listings. */
export async function getAirportLounges(iata: string): Promise<AirportLoungeView[]> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_LOUNGES_CACHE_TAG);

  const rows = await fetchAirportLoungeRows(iata.toUpperCase());
  return rows.filter((row) => row.status !== "closed").map(loungeRowToView);
}

/**
 * A single lounge for its subpage. Closed lounges are still returned — their
 * URLs may be indexed, so the page shows a closed banner instead of a 404.
 */
export async function getAirportLounge(
  iata: string,
  slug: string,
): Promise<AirportLoungeView | null> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_LOUNGES_CACHE_TAG);

  const row = await fetchAirportLoungeRow(iata.toUpperCase(), slug);
  return row ? loungeRowToView(row) : null;
}

/** Every non-closed lounge URL, for generateStaticParams and the sitemap. */
export async function getAllAirportLoungeParams(): Promise<
  Array<{ iata: string; slug: string; updatedAt: Date }>
> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_LOUNGES_CACHE_TAG);

  const rows = await fetchAllAirportLoungeRows();
  return rows
    .filter((row) => row.status !== "closed")
    .map((row) => ({ iata: row.iata.toUpperCase(), slug: row.slug, updatedAt: row.updatedAt }));
}

/**
 * Lounges for the airport page tab: directory rows when the airport has any,
 * otherwise its guide's legacy jsonb lounges (unlinked cards, no subpages).
 */
export async function getAirportLoungesWithFallback(
  iata: string,
): Promise<AirportLoungeView[]> {
  const lounges = await getAirportLounges(iata);
  if (lounges.length > 0) {
    return lounges;
  }

  const guide = await getAirportGuideSummaryByIata(iata);
  return (guide?.lounges ?? []).map(guideLoungeToView);
}

/** Curated reviews seeded from our scoring process, shown alongside live community reviews. */
export async function getEditorialReviews(iata: string): Promise<AirportUserReview[]> {
  "use cache";
  airportContentCacheLife();
  cacheTag(AIRPORT_PROFILES_CACHE_TAG);

  return getEditorialReviewsByIata(iata.toUpperCase());
}
