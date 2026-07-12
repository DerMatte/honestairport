#!/usr/bin/env tsx
/**
 * Lounge photo pipeline: searches Wikimedia Commons for rights-cleared
 * photos of an airport's lounges, has the local `grok` CLI assign candidates
 * to specific lounges (writing alt text and captions), resizes with sharp,
 * uploads to Vercel Blob, and replaces each matched lounge's rows in
 * `airport_lounge_images`.
 *
 * Commons coverage of lounge interiors is sparse — most lounges get no
 * photos, which is a normal outcome, not a failure: lounges without picks
 * are left untouched and their pages simply render without a photo strip.
 * That's also why there is no --next loop here; --all sweeps every airport
 * with lounge rows (skip-and-continue) and is run as a weekly cron.
 *
 * Usage:
 *   pnpm sync:lounge-images LHR              # one specific airport
 *   pnpm sync:lounge-images --all [--dry-run]
 *   pnpm sync:lounge-images LHR --no-grok    # deterministic keyword match
 *
 * Requires BLOB_READ_WRITE_TOKEN and DATABASE_URL in .env.local.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { z } from "zod";
import { getAirportByIata } from "../lib/airports";
import { fetchAirportGuideRow } from "../lib/airport-guides";
import {
  fetchAirportLoungeRows,
  fetchAllAirportLoungeRows,
  slugify,
} from "../lib/lounge-directory";
import { replaceLoungeImages } from "../lib/lounge-images";
import { extractJsonCandidates, runGrokHeadless } from "./grok-headless";
import { extractJsonFromText, runPiHeadless } from "./pi-headless";
import { loadLocalEnv } from "./load-env";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

const MAX_IMAGES_PER_LOUNGE = 4;
const TARGET_WIDTH = 1600;
const WEBP_QUALITY = 78;
const LOG_FILE = path.join(process.cwd(), "scripts/.sync-lounge-images.log");

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
  sourceUrl: string;
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
      candidate.width >= 1000 &&
      candidate.height >= 600 &&
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

interface LoungeTarget {
  slug: string;
  name: string;
  terminal: string;
}

async function searchCommonsCandidates(
  iata: string,
  airportName: string,
  lounges: LoungeTarget[],
): Promise<CommonsCandidate[]> {
  const queries: Record<string, string>[] = [
    {
      generator: "search",
      gsrsearch: `filetype:bitmap ${iata} airport lounge`,
      gsrnamespace: "6",
      gsrlimit: "40",
    },
    {
      generator: "search",
      gsrsearch: `filetype:bitmap "${airportName}" lounge`,
      gsrnamespace: "6",
      gsrlimit: "40",
    },
  ];

  // One targeted query per distinct lounge name (dedup Sky Club × 7 etc.).
  const seenNames = new Set<string>();
  for (const lounge of lounges) {
    const key = slugify(lounge.name);
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    queries.push({
      generator: "search",
      gsrsearch: `filetype:bitmap "${lounge.name}" ${airportName}`,
      gsrnamespace: "6",
      gsrlimit: "15",
    });
  }

  const byPageId = new Map<number, CommonsCandidate>();
  for (const query of queries) {
    try {
      for (const candidate of pagesToCandidates(await commonsQuery(query))) {
        byPageId.set(candidate.pageId, candidate);
      }
    } catch (error) {
      console.warn(`Commons query failed: ${error}`);
    }
  }
  return [...byPageId.values()];
}

// --- Curation: assign candidates to lounges -----------------------------------------

interface AssignedImage {
  candidate: CommonsCandidate;
  loungeSlug: string;
  alt: string;
  caption?: string;
}

const assignmentSchema = z.object({
  images: z
    .array(
      z.object({
        id: z.number(),
        loungeSlug: z.string().trim().min(1),
        alt: z.string().trim().min(10).max(300),
        caption: z.string().trim().min(1).max(200).optional(),
      }),
    )
    .max(60),
});

function buildAssignmentPrompt(
  iata: string,
  airportName: string,
  lounges: LoungeTarget[],
  candidates: CommonsCandidate[],
): string {
  const loungeList = lounges.map(({ slug, name, terminal }) => ({ slug, name, terminal }));
  const candidateList = candidates.map((candidate) => ({
    id: candidate.pageId,
    title: candidate.title,
    description: candidate.description,
  }));

  return `You are picking photos for the individual lounge pages of ${airportName} (${iata}) on a travel guide website.

LOUNGES (each has its own page):
${JSON.stringify(loungeList, null, 2)}

CANDIDATE PHOTOS from Wikimedia Commons (metadata only):
${JSON.stringify(candidateList, null, 2)}

Assign each photo that clearly shows one of these specific lounges (interior, entrance, seating, buffet, views from inside) to that lounge's "loungeSlug". Be strict:
- Only assign a photo when the title/description ties it to that specific lounge (name match, or unambiguous terminal + operator match). Generic terminal shots, gate areas, aircraft, or photos of other airports' lounges must be DROPPED — do not force assignments.
- At most ${MAX_IMAGES_PER_LOUNGE} photos per lounge, best first.
- Most lounges having zero photos is the expected outcome. An empty "images" array is a valid answer.

For each assignment write:
- "alt": a concrete visual description for screen readers, 1 sentence.
- "caption": optional short caption a traveler would find useful.

Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{ "images": [ { "id": 123, "loungeSlug": "...", "alt": "...", "caption": "..." } ] }

Do not create or modify any files. Your only deliverable is the JSON response.`;
}

function payloadsToPicks(
  payloads: unknown[],
  lounges: LoungeTarget[],
  candidates: CommonsCandidate[],
): AssignedImage[] | null {
  const byId = new Map(candidates.map((candidate) => [candidate.pageId, candidate]));
  const validSlugs = new Set(lounges.map((lounge) => lounge.slug));

  for (const payload of payloads) {
    const parsed = assignmentSchema.safeParse(payload);
    if (!parsed.success) continue;

    const picks: AssignedImage[] = [];
    for (const image of parsed.data.images) {
      const candidate = byId.get(image.id);
      if (
        candidate &&
        validSlugs.has(image.loungeSlug) &&
        !picks.some((pick) => pick.candidate.pageId === image.id)
      ) {
        picks.push({
          candidate,
          loungeSlug: image.loungeSlug,
          alt: image.alt,
          caption: image.caption,
        });
      }
    }
    return picks; // empty array is a valid, common outcome
  }

  return null;
}

async function assignWithGrok(
  iata: string,
  airportName: string,
  lounges: LoungeTarget[],
  candidates: CommonsCandidate[],
): Promise<AssignedImage[]> {
  const result = await runGrokHeadless(
    buildAssignmentPrompt(iata, airportName, lounges, candidates),
    { timeoutMs: 10 * 60 * 1000 },
  );

  const picks = payloadsToPicks(extractJsonCandidates(result), lounges, candidates);
  if (picks === null) {
    throw new Error("grok assignment returned no parsable JSON");
  }
  return picks;
}

/** Metadata-only task, so pi needs no web tools — a cheap call even when quota is tight. */
async function assignWithPi(
  iata: string,
  airportName: string,
  lounges: LoungeTarget[],
  candidates: CommonsCandidate[],
): Promise<AssignedImage[]> {
  const result = await runPiHeadless(
    buildAssignmentPrompt(iata, airportName, lounges, candidates),
    { timeoutMs: 10 * 60 * 1000 },
  );

  const picks = payloadsToPicks(
    [extractJsonFromText(result.text ?? "")],
    lounges,
    candidates,
  );
  if (picks === null) {
    throw new Error("pi assignment returned no parsable JSON");
  }
  return picks;
}

/** Name-match fallback when grok is unavailable: strict substring matching only. */
function assignDeterministic(
  lounges: LoungeTarget[],
  candidates: CommonsCandidate[],
): AssignedImage[] {
  const picks: AssignedImage[] = [];

  for (const lounge of lounges) {
    const needle = lounge.name.toLowerCase();
    const matches = candidates
      .filter((candidate) =>
        `${candidate.title} ${candidate.description}`.toLowerCase().includes(needle),
      )
      .slice(0, MAX_IMAGES_PER_LOUNGE);

    for (const candidate of matches) {
      if (picks.some((pick) => pick.candidate.pageId === candidate.pageId)) continue;
      picks.push({
        candidate,
        loungeSlug: lounge.slug,
        alt: candidate.description || `${lounge.name} at the airport`,
      });
    }
  }

  return picks;
}

// --- Processing & upload ----------------------------------------------------------

async function processAndUpload(iata: string, picks: AssignedImage[]) {
  const uploadedBySlug = new Map<
    string,
    Array<{
      url: string;
      alt: string;
      caption?: string;
      credit: string;
      license: string;
      licenseUrl?: string;
      sourceUrl: string;
      width: number;
      height: number;
    }>
  >();

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
        .rotate()
        .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });

      const blob = await put(
        `airports/${iata.toLowerCase()}/lounges/${pick.loungeSlug}-${candidate.pageId}.webp`,
        webp.data,
        {
          access: "public",
          contentType: "image/webp",
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
        },
      );

      const list = uploadedBySlug.get(pick.loungeSlug) ?? [];
      list.push({
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
      uploadedBySlug.set(pick.loungeSlug, list);
    } catch (error) {
      console.warn(`Skipping ${candidate.title}: ${error}`);
    }
  }

  return uploadedBySlug;
}

// --- Main flow --------------------------------------------------------------------

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n").catch(() => {});
}

export async function syncLoungeImages(iata: string, { useGrok = true } = {}) {
  const normalizedIata = iata.toUpperCase();

  const rows = (await fetchAirportLoungeRows(normalizedIata)).filter(
    (row) => row.status !== "closed",
  );
  if (rows.length === 0) {
    await logLine(`${normalizedIata}: no open lounges on record, skipping.`);
    return 0;
  }

  const airportName =
    (await fetchAirportGuideRow(normalizedIata))?.name ??
    getAirportByIata(normalizedIata)?.name ??
    normalizedIata;
  const lounges: LoungeTarget[] = rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    terminal: row.terminal,
  }));

  const candidates = await searchCommonsCandidates(normalizedIata, airportName, lounges);
  if (candidates.length === 0) {
    await logLine(`${normalizedIata}: no licensed Commons candidates, skipping.`);
    return 0;
  }

  let picks: AssignedImage[];
  if (useGrok) {
    try {
      picks = await assignWithGrok(normalizedIata, airportName, lounges, candidates);
    } catch (grokError) {
      await logLine(`grok assignment failed (${grokError}); trying pi.`);
      try {
        picks = await assignWithPi(normalizedIata, airportName, lounges, candidates);
      } catch (piError) {
        await logLine(`pi assignment failed (${piError}); falling back to name matching.`);
        picks = assignDeterministic(lounges, candidates);
      }
    }
  } else {
    picks = assignDeterministic(lounges, candidates);
  }

  if (picks.length === 0) {
    await logLine(
      `${normalizedIata}: ${candidates.length} candidates, none tied to a specific lounge.`,
    );
    return 0;
  }

  const uploadedBySlug = await processAndUpload(normalizedIata, picks);

  let total = 0;
  for (const [loungeSlug, images] of uploadedBySlug) {
    const { orphanedUrls } = await replaceLoungeImages(normalizedIata, loungeSlug, images);
    if (orphanedUrls.length > 0) {
      await del(orphanedUrls).catch((error) => console.warn(`Blob cleanup failed: ${error}`));
    }
    total += images.length;
  }

  if (total > 0) {
    await requestSiteRevalidation();
  }
  await logLine(
    `✅ ${normalizedIata}: ${total} lounge photos live across ${uploadedBySlug.size} lounges.`,
  );
  return total;
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(
      "BLOB_READ_WRITE_TOKEN is not set — add it to .env.local (Vercel Blob store token).",
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const all = args.includes("--all");
  const useGrok = !args.includes("--no-grok");
  const positional = args.filter((arg) => !arg.startsWith("--"));

  if (all) {
    const iatas = [
      ...new Set(
        (await fetchAllAirportLoungeRows())
          .filter((row) => row.status !== "closed")
          .map((row) => row.iata.toUpperCase()),
      ),
    ].sort();

    if (dryRun) {
      console.log(`Would sweep ${iatas.length} airports: ${iatas.join(", ")}`);
      return;
    }

    let photos = 0;
    for (const iata of iatas) {
      try {
        photos += await syncLoungeImages(iata, { useGrok });
      } catch (error) {
        await logLine(`❌ ${iata} failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    await logLine(`Sweep complete: ${photos} lounge photos across ${iatas.length} airports.`);
    return;
  }

  const iata = positional[0];
  if (!iata) {
    console.error("Usage: pnpm sync:lounge-images <IATA> [--no-grok] | --all [--dry-run]");
    process.exit(1);
  }
  await syncLoungeImages(iata, { useGrok });
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    await logLine(`❌ Failed: ${message}`);
    process.exit(1);
  });
