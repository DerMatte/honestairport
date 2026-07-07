#!/usr/bin/env tsx
/**
 * Airport photo pipeline: sources 5-12 rights-cleared images per airport
 * from Wikimedia Commons, has the local `grok` CLI curate them (pick the
 * shots a traveler actually wants to see, write alt text and captions),
 * resizes them with sharp, uploads to Vercel Blob, and replaces the
 * airport's rows in `airport_images`.
 *
 * Only CC0 / CC BY / CC BY-SA / public-domain images pass the license
 * filter; artist + license are stored per image and rendered as credits.
 *
 * Usage:
 *   pnpm sync:images LHR                 # one specific airport
 *   pnpm sync:images --next              # next guide airport short on photos
 *   pnpm sync:images --next --dry-run    # show what --next would pick
 *   pnpm sync:images LHR --no-grok       # deterministic pick (no curation)
 *
 * Requires BLOB_READ_WRITE_TOKEN (Vercel Blob) and DATABASE_URL in
 * .env.local. Designed for one-by-one background runs on the VPS cron.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { z } from "zod";
import { fetchAllAirportGuideRows } from "../lib/airport-guides";
import { fetchAirportImageCounts, replaceAirportImages } from "../lib/airport-images";
import { getAirportByIata } from "../lib/airports";
import { getMajorAirportCandidates } from "../lib/major-airports";
import { extractJsonCandidates, runGrokHeadless } from "./grok-headless";
import { loadLocalEnv } from "./load-env";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

const MIN_IMAGES = 5;
const MAX_IMAGES = 12;
const TARGET_WIDTH = 1600;
const WEBP_QUALITY = 78;
const LOG_FILE = path.join(process.cwd(), "scripts/.sync-airport-images.log");

// Commons asks API clients to identify themselves.
const USER_AGENT =
  "HonestAirportImageSync/1.0 (https://www.honestairport.com; lanaswebdev@gmail.com)";

// --- Wikimedia Commons ------------------------------------------------------------

interface CommonsCandidate {
  pageId: number;
  title: string;
  description: string;
  artist: string;
  license: string;
  licenseUrl?: string;
  /** Commons file page, e.g. https://commons.wikimedia.org/wiki/File:... */
  sourceUrl: string;
  /** Server-side scaled download URL (~TARGET_WIDTH px wide). */
  thumbUrl: string;
  width: number;
  height: number;
}

const ALLOWED_LICENSE = /^(cc0|cc[ -]by(?:[ -]sa)?(?:[ -]\d|\b)|public domain|pd\b|no restrictions)/i;
const REJECT_TITLE =
  /\b(map|logo|diagram|plan|chart|timetable|scan|crest|coat of arms|stamp|banknote|screenshot|icon)\b/i;

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function commonsQuery(params: Record<string, string>): Promise<unknown> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  for (const [key, value] of Object.entries({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: String(TARGET_WIDTH),
    ...params,
  })) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`Commons API ${response.status} for ${url.pathname}${url.search}`);
  }
  return response.json();
}

interface CommonsPage {
  pageid: number;
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    descriptionurl: string;
    width: number;
    height: number;
    mime: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}

function pagesToCandidates(payload: unknown): CommonsCandidate[] {
  const pages =
    ((payload as { query?: { pages?: CommonsPage[] } }).query?.pages ?? []) as CommonsPage[];

  const candidates: CommonsCandidate[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;

    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? "");
    const candidate: CommonsCandidate = {
      pageId: page.pageid,
      title: page.title.replace(/^File:/, ""),
      description: stripHtml(meta.ImageDescription?.value ?? "").slice(0, 300),
      artist: stripHtml(meta.Artist?.value ?? ""),
      license,
      licenseUrl: meta.LicenseUrl?.value?.trim() || undefined,
      sourceUrl: info.descriptionurl,
      thumbUrl: info.thumburl ?? info.url,
      width: info.width,
      height: info.height,
    };

    const aspect = candidate.width / Math.max(candidate.height, 1);
    if (
      /^image\/(jpeg|png)$/.test(info.mime) &&
      ALLOWED_LICENSE.test(license) &&
      candidate.width >= 1200 &&
      candidate.height >= 700 &&
      aspect >= 0.7 &&
      aspect <= 2.6 &&
      !REJECT_TITLE.test(candidate.title) &&
      !REJECT_TITLE.test(candidate.description)
    ) {
      candidates.push(candidate);
    }
  }
  return candidates;
}

async function searchCommonsCandidates(iata: string, airportName: string) {
  const record = getAirportByIata(iata);
  const queries: Record<string, string>[] = [
    {
      generator: "search",
      gsrsearch: `filetype:bitmap "${airportName}"`,
      gsrnamespace: "6",
      gsrlimit: "50",
    },
    {
      generator: "search",
      gsrsearch: `filetype:bitmap ${iata} airport terminal`,
      gsrnamespace: "6",
      gsrlimit: "30",
    },
  ];
  if (record) {
    queries.push({
      generator: "geosearch",
      ggscoord: `${record.latitude}|${record.longitude}`,
      ggsradius: "3000",
      ggsnamespace: "6",
      ggslimit: "50",
    });
  }

  const byPageId = new Map<number, CommonsCandidate>();
  for (const query of queries) {
    try {
      for (const candidate of pagesToCandidates(await commonsQuery(query))) {
        byPageId.set(candidate.pageId, candidate);
      }
    } catch (error) {
      console.warn(`Commons query failed (${query.generator}): ${error}`);
    }
  }
  return [...byPageId.values()];
}

// --- Curation ---------------------------------------------------------------------

interface CuratedImage {
  candidate: CommonsCandidate;
  alt: string;
  caption?: string;
}

const curationSchema = z.object({
  images: z
    .array(
      z.object({
        id: z.number(),
        alt: z.string().trim().min(10).max(300),
        caption: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .min(1)
    .max(MAX_IMAGES),
});

function buildCurationPrompt(
  iata: string,
  airportName: string,
  candidates: CommonsCandidate[],
): string {
  const list = candidates.map((candidate) => ({
    id: candidate.pageId,
    title: candidate.title,
    description: candidate.description,
    width: candidate.width,
    height: candidate.height,
  }));

  return `You are curating a photo gallery for the ${airportName} (${iata}) page of a travel guide website. Below is a JSON list of candidate photos from Wikimedia Commons (metadata only).

Pick the ${MIN_IMAGES}-${MAX_IMAGES} photos that best show a traveler what this airport is actually like, ordered best-first. Prefer variety: terminal interiors (check-in, security, gates, lounges), exteriors, and rail/transit connections. Avoid near-duplicates, aircraft close-ups that could be at any airport, historic/black-and-white shots, and anything that looks unrelated to ${airportName}. If fewer than ${MIN_IMAGES} candidates are genuinely good, pick only the good ones.

For each pick write:
- "alt": a concrete visual description for screen readers (what is in the frame), 1 sentence.
- "caption": optional short caption a traveler would find useful.

Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{ "images": [ { "id": 123, "alt": "...", "caption": "..." } ] }

Do not create or modify any files. Your only deliverable is the JSON response.

Candidates:
${JSON.stringify(list, null, 2)}`;
}

async function curateWithGrok(
  iata: string,
  airportName: string,
  candidates: CommonsCandidate[],
): Promise<CuratedImage[]> {
  const result = await runGrokHeadless(buildCurationPrompt(iata, airportName, candidates), {
    timeoutMs: 10 * 60 * 1000,
  });

  const byId = new Map(candidates.map((candidate) => [candidate.pageId, candidate]));
  for (const payload of extractJsonCandidates(result)) {
    const parsed = curationSchema.safeParse(payload);
    if (!parsed.success) continue;

    const picks: CuratedImage[] = [];
    for (const image of parsed.data.images) {
      const candidate = byId.get(image.id);
      if (candidate && !picks.some((pick) => pick.candidate.pageId === image.id)) {
        picks.push({ candidate, alt: image.alt, caption: image.caption });
      }
    }
    if (picks.length > 0) {
      return picks.slice(0, MAX_IMAGES);
    }
  }

  throw new Error("grok curation returned no usable picks");
}

/** Keyword-scored fallback when grok is unavailable. */
function curateDeterministic(airportName: string, candidates: CommonsCandidate[]): CuratedImage[] {
  const keywords = ["terminal", "departure", "arrival", "check-in", "gate", "interior", "concourse", "lounge", "station", "airport"];
  const nameParts = airportName.toLowerCase().split(/\s+/).filter((part) => part.length > 3);

  const scored = candidates
    .map((candidate) => {
      const text = `${candidate.title} ${candidate.description}`.toLowerCase();
      let score = Math.min(candidate.width, 4000) / 1000;
      for (const keyword of keywords) if (text.includes(keyword)) score += 2;
      for (const part of nameParts) if (text.includes(part)) score += 3;
      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_IMAGES);

  return scored.map(({ candidate }) => ({
    candidate,
    alt: candidate.description || `${candidate.title.replace(/\.[a-z]+$/i, "")} — ${airportName}`,
  }));
}

// --- Processing & upload ----------------------------------------------------------

async function processAndUpload(iata: string, picks: CuratedImage[]) {
  const uploaded = [];

  for (const pick of picks) {
    const { candidate } = pick;
    try {
      const response = await fetch(candidate.thumbUrl, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!response.ok) {
        throw new Error(`download failed (${response.status})`);
      }

      const webp = await sharp(Buffer.from(await response.arrayBuffer()))
        .rotate() // apply EXIF orientation before stripping metadata
        .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });

      const blob = await put(
        `airports/${iata.toLowerCase()}/${candidate.pageId}.webp`,
        webp.data,
        {
          access: "public",
          contentType: "image/webp",
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
        },
      );

      uploaded.push({
        url: blob.url,
        alt: pick.alt,
        caption: pick.caption,
        credit: candidate.artist || "Wikimedia Commons",
        license: candidate.license,
        licenseUrl: candidate.licenseUrl,
        sourceUrl: candidate.sourceUrl,
        width: webp.info.width,
        height: webp.info.height,
      });
    } catch (error) {
      console.warn(`Skipping ${candidate.title}: ${error}`);
    }
  }

  return uploaded;
}

// --- Main flow --------------------------------------------------------------------

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n").catch(() => {});
}

export async function syncAirportImages(iata: string, { useGrok = true } = {}) {
  const normalizedIata = iata.toUpperCase();
  const guide = (await fetchAllAirportGuideRows()).find(
    (row) => row.iata.toUpperCase() === normalizedIata,
  );
  if (!guide) {
    throw new Error(`No guide for ${normalizedIata} — generate the guide first.`);
  }

  await logLine(`Searching Commons for ${normalizedIata} (${guide.name})…`);
  const candidates = await searchCommonsCandidates(normalizedIata, guide.name);
  if (candidates.length === 0) {
    throw new Error(`No usable Commons candidates for ${normalizedIata}`);
  }
  await logLine(`${candidates.length} licensed candidates found.`);

  let picks: CuratedImage[];
  if (useGrok) {
    try {
      picks = await curateWithGrok(normalizedIata, guide.name, candidates);
      await logLine(`grok curated ${picks.length} images.`);
    } catch (error) {
      await logLine(`grok curation failed (${error}); falling back to keyword ranking.`);
      picks = curateDeterministic(guide.name, candidates);
    }
  } else {
    picks = curateDeterministic(guide.name, candidates);
  }

  const uploaded = await processAndUpload(normalizedIata, picks);
  if (uploaded.length === 0) {
    throw new Error(`All downloads/uploads failed for ${normalizedIata}`);
  }
  if (uploaded.length < MIN_IMAGES) {
    await logLine(`⚠ Only ${uploaded.length} images made it (target ${MIN_IMAGES}-${MAX_IMAGES}).`);
  }

  const { orphanedUrls } = await replaceAirportImages(normalizedIata, uploaded);
  if (orphanedUrls.length > 0) {
    await del(orphanedUrls).catch((error) => console.warn(`Blob cleanup failed: ${error}`));
  }

  await requestSiteRevalidation();
  await logLine(`✅ ${normalizedIata}: ${uploaded.length} images live (${orphanedUrls.length} old blobs removed).`);
  return uploaded.length;
}

/**
 * Next airport to photograph: guides short on images, busiest airports
 * first (same priority order the guide generator uses).
 */
async function pickNextTarget(): Promise<{ iata: string; reason: string } | null> {
  const guides = await fetchAllAirportGuideRows();
  const counts = await fetchAirportImageCounts();

  const rankByIata = new Map(
    getMajorAirportCandidates().map((candidate) => [candidate.iata, candidate.rank]),
  );
  const short = guides
    .map((row) => {
      const iata = row.iata.toUpperCase();
      return { iata, count: counts.get(iata) ?? 0, rank: rankByIata.get(iata) ?? 999 };
    })
    .filter((entry) => entry.count < MIN_IMAGES)
    .sort((a, b) => a.count - b.count || a.rank - b.rank);

  const target = short[0];
  return target
    ? { iata: target.iata, reason: `${target.count} images (rank ${target.rank})` }
    : null;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is not set — add it to .env.local (Vercel Blob store token).");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const useNext = args.includes("--next");
  const useGrok = !args.includes("--no-grok");
  const positional = args.filter((arg) => !arg.startsWith("--"));

  if (useNext) {
    const target = await pickNextTarget();
    if (!target) {
      console.log(`Every guide airport has at least ${MIN_IMAGES} images. Nothing to do.`);
      return;
    }
    if (dryRun) {
      console.log(`Next up: ${target.iata} — ${target.reason}`);
      return;
    }
    await logLine(`--next picked ${target.iata}: ${target.reason}`);
    await syncAirportImages(target.iata, { useGrok });
    return;
  }

  const iata = positional[0];
  if (!iata) {
    console.error("Usage: pnpm sync:images <IATA> [--no-grok] | --next [--dry-run]");
    process.exit(1);
  }
  await syncAirportImages(iata, { useGrok });
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    await logLine(`❌ Failed: ${message}`);
    process.exit(1);
  });
