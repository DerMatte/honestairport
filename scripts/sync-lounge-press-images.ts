#!/usr/bin/env tsx
/**
 * Press-kit photo pipeline for lounges Wikimedia Commons can't cover:
 * researches each airport's photo-less lounges with the local `pi` CLI and
 * sources official images published for editorial use — the lounge
 * operator's or airline's press/media/newsroom pages and the airport's own
 * media library. Downloads, resizes, uploads to Vercel Blob, and writes
 * `airport_lounge_images` rows crediting the operator, with the source page
 * and usage-terms URL stored per image so every photo stays auditable (and
 * trivially removable if an owner ever objects).
 *
 * Only lounges with ZERO images are touched — Commons finds are never
 * replaced. An empty result for a lounge is a normal outcome; the weekly
 * cron re-sweeps, so there is no retry loop.
 *
 * Usage:
 *   pnpm sync:lounge-press LHR              # one specific airport
 *   pnpm sync:lounge-press --all [--dry-run]
 *
 * Requires BLOB_READ_WRITE_TOKEN and DATABASE_URL in .env.local; research
 * runs on the pi CLI (no API key).
 */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { z } from "zod";
import { getAirportByIata } from "../lib/airports";
import { fetchAirportGuideRow } from "../lib/airport-guides";
import { fetchAirportLoungeRows, fetchAllAirportLoungeRows } from "../lib/lounge-directory";
import {
  fetchAllLoungeImageRowsForAirport,
  replaceLoungeImages,
} from "../lib/lounge-images";
import { loadLocalEnv } from "./load-env";
import { extractJsonFromText, runPiHeadless } from "./pi-headless";
import { requestSiteRevalidation } from "./revalidate-site";

loadLocalEnv();

const MAX_IMAGES_PER_LOUNGE = 3;
const TARGET_WIDTH = 1600;
const WEBP_QUALITY = 78;
const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const PI_TIMEOUT_MS = 30 * 60 * 1000;
const LOG_FILE = path.join(process.cwd(), "scripts/.sync-lounge-press-images.log");

const USER_AGENT =
  "HonestAirportImageSync/1.0 (https://www.honestairport.com; lanaswebdev@gmail.com)";

// --- Model output schema --------------------------------------------------------

const pressImageSchema = z.object({
  imageUrl: z.url(),
  /** Page the image was found on (press/media/newsroom section). */
  pageUrl: z.url(),
  /** Usage/terms page when one exists; falls back to pageUrl for the record. */
  termsUrl: z.url().optional(),
  /** Rights holder to credit, e.g. "Plaza Premium Group", "Delta Air Lines". */
  credit: z.string().trim().min(2).max(120),
  alt: z.string().trim().min(10).max(300),
  caption: z.string().trim().min(1).max(200).optional(),
});

const responseSchema = z.object({
  iata: z.string().regex(/^[A-Z]{3}$/),
  lounges: z
    .array(
      z.object({
        slug: z.string().trim().min(1),
        images: z.array(pressImageSchema).max(MAX_IMAGES_PER_LOUNGE),
      }),
    )
    .default([]),
});

// --- Prompt ---------------------------------------------------------------------

interface LoungeTarget {
  slug: string;
  name: string;
  terminal: string;
}

function buildPressPrompt(
  iata: string,
  airportName: string,
  lounges: LoungeTarget[],
): string {
  return `You are sourcing official photos for the individual lounge pages of ${airportName} (${iata}) on a travel guide website. The site only uses images published for editorial/press use, credited to the rights holder, with the source recorded.

LOUNGES needing photos:
${JSON.stringify(lounges, null, 2)}

STEP 1 — RESEARCH with web_search and fetch_content. For each lounge, look for official imagery in this order:
1. The lounge operator's press/media/newsroom section (Plaza Premium press room, Aspire/Swissport media, airline newsrooms and media libraries — Delta News Hub, Lufthansa Newsroom, united.com newsroom, Amex newsroom, etc.).
2. The airport's own press/media library or image bank (many airports host one with editorial-use terms).
3. The operator's official lounge page ONLY if the site offers the images expressly for media/press download.

Search tactics that work:
- Many newsrooms run on Presspage: their article pages embed full-resolution press images as direct https://content.presspage.com/... URLs — those are downloadable press assets. Search "<operator> newsroom <lounge name>" and "<operator> press release lounge ${iata}", then fetch the article and lift its content.presspage.com image URLs.
- Try "<airport name> media centre images", "<airport name> press photos lounge", and the operator name + "press kit".
- Lounge OPENING announcements are the best articles — they nearly always ship with interior photos.
- Fetch several candidate pages before giving up on a lounge; but never widen beyond press/media contexts.

HARD RULES:
- Only direct image URLs (jpg/jpeg/png/webp) hosted on the official domain or its CDN, found on pages you actually fetched.
- The page must be a press/media/newsroom/image-library context, or state that the material is provided for editorial or press use. Marketing pages, booking pages, Google Images, stock-photo sites, review blogs, and social media are all OFF LIMITS.
- Record the page URL you found each image on ("pageUrl") and, when the site has a usage/terms page for its media, that URL ("termsUrl").
- "credit" is the rights holder as the site names it.
- The image must clearly show THAT specific lounge. When unsure which lounge a photo shows, skip it.
- At most ${MAX_IMAGES_PER_LOUNGE} images per lounge. Finding nothing for most lounges is an acceptable and expected result — return them omitted or with an empty images array rather than stretching the rules.

STEP 2 — OUTPUT. Reply with ONLY a single JSON object (no markdown, no code fences):

{
  "iata": "${iata}",
  "lounges": [
    {
      "slug": "the-lounge-slug",
      "images": [
        {
          "imageUrl": "https://.../lounge.jpg",
          "pageUrl": "https://.../newsroom/...",
          "termsUrl": "https://.../media-terms (optional)",
          "credit": "Rights holder name",
          "alt": "Concrete visual description for screen readers, 1 sentence.",
          "caption": "Optional short caption a traveler would find useful."
        }
      ]
    }
  ]
}

Do not create or modify any files. Your only deliverable is the JSON response.`;
}

// --- Download & upload -------------------------------------------------------------

/**
 * Models reconstruct image URLs imperfectly (pattern drift, stale CDN
 * paths), so when the claimed URL fails we fetch the article page the model
 * actually read and lift real image URLs out of its HTML — og:image first,
 * then <img>/srcset entries ranked by filename-token overlap with the
 * model's (broken) hint URL.
 */
async function recoverImageUrls(pageUrl: string, hintUrl: string): Promise<string[]> {
  let html: string;
  try {
    const response = await fetch(pageUrl, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });
    if (!response.ok) return [];
    html = await response.text();
  } catch {
    return [];
  }

  const found = new Set<string>();
  const push = (raw: string | undefined) => {
    if (!raw) return;
    let url = raw.trim().replace(/&amp;/g, "&");
    if (url.startsWith("//")) url = `https:${url}`;
    if (!/^https?:\/\//.test(url)) {
      try {
        url = new URL(url, pageUrl).toString();
      } catch {
        return;
      }
    }
    if (/\.(jpe?g|png|webp)(\?|$)/i.test(url)) found.add(url);
  };

  for (const match of html.matchAll(
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
  )) {
    push(match[1]);
  }
  for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    push(match[1]);
  }
  for (const match of html.matchAll(/srcset=["']([^"']+)["']/gi)) {
    const entries = match[1].split(",").map((entry) => entry.trim().split(/\s+/)[0]);
    push(entries[entries.length - 1]);
  }

  const hintTokens = new Set(
    (hintUrl.split("/").pop() ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3),
  );
  const score = (url: string) => {
    const name = (url.split("/").pop() ?? "").toLowerCase();
    let hits = 0;
    for (const token of hintTokens) if (name.includes(token)) hits += 1;
    return hits;
  };

  return [...found].sort((a, b) => score(b) - score(a)).slice(0, 5);
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/*" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`download failed (${response.status})`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png|webp)/.test(contentType)) {
    throw new Error(`unexpected content-type ${contentType}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error(`image too large (${buffer.byteLength} bytes)`);
  }
  return buffer;
}

async function downloadAndUpload(
  iata: string,
  loungeSlug: string,
  image: z.infer<typeof pressImageSchema>,
) {
  let buffer: Buffer | null = null;
  try {
    buffer = await fetchImageBuffer(image.imageUrl);
  } catch (directError) {
    for (const candidate of await recoverImageUrls(image.pageUrl, image.imageUrl)) {
      try {
        buffer = await fetchImageBuffer(candidate);
        console.warn(`Recovered ${loungeSlug} image from page HTML: ${candidate}`);
        break;
      } catch {
        // try the next candidate
      }
    }
    if (!buffer) {
      throw directError;
    }
  }

  const webp = await sharp(buffer)
    .rotate()
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  if (webp.info.width < 640 || webp.info.height < 400) {
    throw new Error(`image too small (${webp.info.width}x${webp.info.height})`);
  }

  const hash = crypto.createHash("md5").update(image.imageUrl).digest("hex").slice(0, 10);
  const blob = await put(
    `airports/${iata.toLowerCase()}/lounges/${loungeSlug}-press-${hash}.webp`,
    webp.data,
    {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    },
  );

  return {
    url: blob.url,
    alt: image.alt,
    caption: image.caption,
    credit: image.credit,
    license: "Official press image",
    licenseUrl: image.termsUrl ?? image.pageUrl,
    sourceUrl: image.pageUrl,
    width: webp.info.width,
    height: webp.info.height,
  };
}

// --- Main flow --------------------------------------------------------------------

async function logLine(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(message);
  await fs.appendFile(LOG_FILE, line + "\n").catch(() => {});
}

export async function syncLoungePressImages(iata: string): Promise<number> {
  const normalizedIata = iata.toUpperCase();

  const [loungeRows, imageRows] = await Promise.all([
    fetchAirportLoungeRows(normalizedIata),
    fetchAllLoungeImageRowsForAirport(normalizedIata),
  ]);
  const covered = new Set(imageRows.map((row) => row.loungeSlug));
  const targets: LoungeTarget[] = loungeRows
    .filter((row) => row.status !== "closed" && !covered.has(row.slug))
    .map((row) => ({ slug: row.slug, name: row.name, terminal: row.terminal }));

  if (targets.length === 0) {
    await logLine(`${normalizedIata}: every open lounge already has photos, skipping.`);
    return 0;
  }

  const airportName =
    (await fetchAirportGuideRow(normalizedIata))?.name ??
    getAirportByIata(normalizedIata)?.name ??
    normalizedIata;

  await logLine(
    `Researching press images for ${normalizedIata} (${targets.length} photo-less lounges)…`,
  );

  const result = await runPiHeadless(
    buildPressPrompt(normalizedIata, airportName, targets),
    { timeoutMs: PI_TIMEOUT_MS },
  );

  const parsed = responseSchema.safeParse(extractJsonFromText(result.text ?? ""));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`pi output failed schema validation: ${detail}`);
  }
  if (parsed.data.iata !== normalizedIata) {
    throw new Error(`pi returned images for ${parsed.data.iata}, expected ${normalizedIata}`);
  }

  const validSlugs = new Set(targets.map((target) => target.slug));
  let total = 0;

  for (const lounge of parsed.data.lounges) {
    if (!validSlugs.has(lounge.slug) || lounge.images.length === 0) {
      continue;
    }

    const uploaded = [];
    for (const image of lounge.images) {
      try {
        uploaded.push(await downloadAndUpload(normalizedIata, lounge.slug, image));
      } catch (error) {
        console.warn(`Skipping ${image.imageUrl}: ${error}`);
      }
    }

    if (uploaded.length > 0) {
      const { orphanedUrls } = await replaceLoungeImages(normalizedIata, lounge.slug, uploaded);
      if (orphanedUrls.length > 0) {
        await del(orphanedUrls).catch((error) => console.warn(`Blob cleanup failed: ${error}`));
      }
      total += uploaded.length;
    }
  }

  if (total > 0) {
    await requestSiteRevalidation();
  }
  await logLine(`✅ ${normalizedIata}: ${total} press photos live.`);
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
        photos += await syncLoungePressImages(iata);
      } catch (error) {
        await logLine(`❌ ${iata} failed: ${error instanceof Error ? error.message : error}`);
      }
    }
    await logLine(`Sweep complete: ${photos} press photos.`);
    return;
  }

  const iata = positional[0];
  if (!iata) {
    console.error("Usage: pnpm sync:lounge-press <IATA> | --all [--dry-run]");
    process.exit(1);
  }
  await syncLoungePressImages(iata);
}

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    const message = error instanceof Error ? error.message : String(error);
    await logLine(`❌ Failed: ${message}`);
    process.exit(1);
  });
