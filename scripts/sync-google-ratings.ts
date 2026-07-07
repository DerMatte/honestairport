#!/usr/bin/env tsx
/**
 * Google Maps rating sync: fetches each airport's aggregate Google rating
 * and review count through ScrapingBee's Google API (search_type=maps) and
 * upserts one row per airport into `airport_google_ratings`. The rating is
 * crowd intel for calibrating the Airportist Score and is shown on airport
 * pages as "Google rating".
 *
 * Usage:
 *   pnpm sync:ratings LHR JFK            # specific airports
 *   pnpm sync:ratings --next             # next airport missing/stale (30d), busiest first
 *   pnpm sync:ratings --next --dry-run   # fetch + print, no DB write
 *   pnpm sync:ratings --all              # every curated + guide airport (mind API credits)
 *
 * Requires SCRAPINGBEE_API_KEY and DATABASE_URL in .env.local. Designed for
 * one-by-one background runs on the VPS cron; ratings older than 30 days
 * count as stale so --next keeps the data fresh.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fetchAllAirportGuideRows } from "../lib/airport-guides";
import { getAirportByIata } from "../lib/airports";
import { airports as curatedAirports } from "../lib/data";
import {
  fetchAllAirportGoogleRatingRows,
  upsertAirportGoogleRating,
} from "../lib/google-ratings";
import { getMajorAirportCandidates } from "../lib/major-airports";
import { loadLocalEnv } from "./load-env";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

const SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1/store/google";
const STALE_AFTER_DAYS = 30;
const LOG_FILE = path.join(process.cwd(), "scripts/.sync-google-ratings.log");

// Below this, the match is more likely a shuttle desk or airport hotel than
// the airport itself — every real airport listing has hundreds of reviews.
const MIN_REVIEW_COUNT = 50;

interface AirportTarget {
  iata: string;
  name: string;
  city: string;
}

// --- ScrapingBee Google Maps search -------------------------------------------------

interface RatingCandidate {
  title: string;
  rating: number;
  reviewCount: number;
  raw: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[,\s]/g, ""));
      if (Number.isFinite(parsed) && value.trim() !== "") return parsed;
    }
  }
  return undefined;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * ScrapingBee's structured Google responses have shifted key names over time
 * (maps_results / map_results / local_results; review vs rating; review_count
 * vs reviews), so extraction is deliberately loose: collect anything with a
 * plausible title + 1-5 rating + review count from every known location.
 */
function extractCandidates(payload: unknown): RatingCandidate[] {
  const root = asRecord(payload);
  if (!root) return [];

  const groups: unknown[] = [];
  for (const key of ["maps_results", "map_results", "local_results", "organic_results"]) {
    const group = root[key];
    if (Array.isArray(group)) groups.push(...group);
  }
  // Single-place response shape (knowledge graph / place lookup).
  groups.push(root.knowledge_graph, root);

  const candidates: RatingCandidate[] = [];
  for (const entry of groups) {
    const record = asRecord(entry);
    if (!record) continue;

    const title = firstString(record, ["title", "name", "place_name"]);
    const rating = firstNumber(record, ["rating", "review", "stars"]);
    const reviewCount = firstNumber(record, [
      "review_count",
      "reviews_count",
      "total_reviews",
      "reviews",
      "user_ratings_total",
    ]);

    if (title && rating !== undefined && rating >= 1 && rating <= 5 && reviewCount) {
      candidates.push({ title, rating, reviewCount: Math.round(reviewCount), raw: record });
    }
  }
  return candidates;
}

async function searchGoogleMaps(query: string): Promise<RatingCandidate[]> {
  const url = new URL(SCRAPINGBEE_URL);
  url.searchParams.set("api_key", process.env.SCRAPINGBEE_API_KEY ?? "");
  url.searchParams.set("search", query);
  url.searchParams.set("search_type", "maps");
  url.searchParams.set("language", "en");

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ScrapingBee ${response.status}: ${body.slice(0, 300)}`);
  }
  return extractCandidates(await response.json());
}

// --- Matching -----------------------------------------------------------------------

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

/**
 * Pick the result that is actually the airport: name-token overlap and the
 * word "airport" matter most; review count breaks ties (the airport listing
 * dwarfs nearby hotels and shuttle desks).
 */
function pickBestMatch(
  target: AirportTarget,
  candidates: RatingCandidate[],
): RatingCandidate | null {
  const nameTokens = new Set([...tokenize(target.name), ...tokenize(target.city)]);

  let best: { candidate: RatingCandidate; score: number } | null = null;
  for (const candidate of candidates) {
    if (candidate.reviewCount < MIN_REVIEW_COUNT) continue;

    const titleTokens = tokenize(candidate.title);
    const overlap = titleTokens.filter((token) => nameTokens.has(token)).length;
    const score =
      overlap * 2 +
      (/\bairport\b|\baeroporto\b|\baeropuerto\b|\bflughafen\b/i.test(candidate.title) ? 3 : 0) +
      Math.log10(candidate.reviewCount);

    if (overlap === 0) continue;
    if (!best || score > best.score) {
      best = { candidate, score };
    }
  }
  return best?.candidate ?? null;
}

// --- Main flow ----------------------------------------------------------------------

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n").catch(() => {});
}

function resolveTarget(iata: string): AirportTarget | null {
  const normalized = iata.toUpperCase();
  const curated = curatedAirports.find((airport) => airport.iata === normalized);
  if (curated) {
    return { iata: normalized, name: curated.name, city: curated.city };
  }
  const record = getAirportByIata(normalized);
  return record
    ? { iata: normalized, name: record.name, city: record.city_name }
    : null;
}

async function syncAirportRating(target: AirportTarget, { dryRun = false } = {}) {
  const query = `${target.name} ${target.city} airport`;
  await logLine(`Searching Google Maps for ${target.iata} ("${query}")…`);

  const candidates = await searchGoogleMaps(query);
  if (candidates.length === 0) {
    throw new Error(`No rated places in ScrapingBee response for ${target.iata}`);
  }

  const match = pickBestMatch(target, candidates);
  if (!match) {
    const seen = candidates
      .slice(0, 5)
      .map((candidate) => `"${candidate.title}" (${candidate.rating}★, ${candidate.reviewCount})`)
      .join(", ");
    throw new Error(`No candidate matched ${target.iata} — saw: ${seen}`);
  }

  const summary = `${target.iata}: "${match.title}" ${match.rating}★ from ${match.reviewCount.toLocaleString()} reviews`;
  if (dryRun) {
    await logLine(`[dry-run] ${summary}`);
    return;
  }

  await upsertAirportGoogleRating(target.iata, {
    placeName: match.title,
    rating: match.rating,
    reviewCount: match.reviewCount,
    raw: match.raw,
  });
  await logLine(`✅ ${summary}`);
}

/** Curated airports + every guide airport, deduped. */
async function collectAllTargets(): Promise<AirportTarget[]> {
  const byIata = new Map<string, AirportTarget>();
  for (const airport of curatedAirports) {
    byIata.set(airport.iata, { iata: airport.iata, name: airport.name, city: airport.city });
  }
  for (const row of await fetchAllAirportGuideRows()) {
    const iata = row.iata.toUpperCase();
    if (!byIata.has(iata)) {
      byIata.set(iata, { iata, name: row.name, city: row.city });
    }
  }
  return [...byIata.values()];
}

/**
 * Next airport to rate: never-fetched first (busiest first, same priority
 * order the guide generator uses), then the stalest rating past the 30-day
 * window.
 */
async function pickNextTarget(): Promise<AirportTarget | null> {
  const targets = await collectAllTargets();
  const existing = new Map(
    (await fetchAllAirportGoogleRatingRows()).map((row) => [row.iata.toUpperCase(), row]),
  );
  const rankByIata = new Map(
    getMajorAirportCandidates().map((candidate) => [candidate.iata, candidate.rank]),
  );

  const missing = targets
    .filter((target) => !existing.has(target.iata))
    .sort((a, b) => (rankByIata.get(a.iata) ?? 999) - (rankByIata.get(b.iata) ?? 999));
  if (missing.length > 0) return missing[0];

  const staleCutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const stale = targets
    .map((target) => ({ target, row: existing.get(target.iata)! }))
    .filter(({ row }) => row.fetchedAt.getTime() < staleCutoff)
    .sort((a, b) => a.row.fetchedAt.getTime() - b.row.fetchedAt.getTime());
  return stale[0]?.target ?? null;
}

async function main() {
  if (!process.env.SCRAPINGBEE_API_KEY) {
    console.error("SCRAPINGBEE_API_KEY is not set — add it to .env.local (scrapingbee.com API key).");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const useNext = args.includes("--next");
  const useAll = args.includes("--all");
  const positional = args.filter((arg) => !arg.startsWith("--"));

  let targets: AirportTarget[];
  if (useNext) {
    const target = await pickNextTarget();
    if (!target) {
      console.log(`Every airport has a Google rating fresher than ${STALE_AFTER_DAYS} days. Nothing to do.`);
      return;
    }
    targets = [target];
  } else if (useAll) {
    targets = await collectAllTargets();
    console.log(`Syncing ${targets.length} airports (1 ScrapingBee credit-bearing call each).`);
  } else if (positional.length > 0) {
    targets = positional.map((iata) => {
      const target = resolveTarget(iata);
      if (!target) {
        console.error(`Unknown IATA code: ${iata}`);
        process.exit(1);
      }
      return target;
    });
  } else {
    console.error("Usage: pnpm sync:ratings <IATA...> | --next | --all [--dry-run]");
    process.exit(1);
  }

  let failures = 0;
  for (const target of targets) {
    try {
      await syncAirportRating(target, { dryRun });
    } catch (error) {
      failures += 1;
      await logLine(`❌ ${target.iata} failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  if (!dryRun && failures < targets.length) {
    await requestSiteRevalidation();
  }
  if (failures > 0) {
    process.exit(1);
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
