/**
 * Review photo domain logic: upload validation, normalisation to WebP, Vercel
 * Blob writes and raw (uncached) Postgres access.
 *
 * Mirrors the split in `lib/airport-images.ts` — Next-free on purpose so the
 * same code could be driven from a script. The re-encode is the trust boundary
 * for everything a browser hands us: the client may downscale first for upload
 * speed, but we never rely on it, and re-encoding is what strips EXIF/GPS off
 * the poster's photos.
 */
import { asc, inArray } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import exifReader from "exif-reader";
import sharp from "sharp";
import { getAirportByIata } from "./airports";
import { haversineKm } from "./geo";
import { getDb, isDatabaseConfigured } from "./db";
import { airportReviewImages, type AirportReviewImageRow } from "./db/schema";
import {
  MAX_REVIEW_CAPTION_LENGTH,
  MAX_REVIEW_IMAGES,
  type ReviewImage,
} from "./review-schema";

/** Generous per-file ceiling — the client downscales first, so this is a backstop. */
const MAX_UPLOAD_BYTES_PER_FILE = 12 * 1024 * 1024;

/** What a browser file picker may offer us. HEIC is excluded: prebuilt sharp
 * ships without libheif, so the form's `accept` list steers iOS into handing us
 * JPEG instead. SVG is never allowed. */
const ALLOWED_UPLOAD_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

/** The authoritative check — `File.type` is client-supplied and can lie. */
const ALLOWED_SHARP_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);

// Match the Commons pipeline so review photos and airport photos are the same
// weight on the wire (scripts/sync-airport-images.ts).
const TARGET_WIDTH = 1600;
const WEBP_QUALITY = 78;

/**
 * sharp defaults to ~268 megapixels, which lets a 40 KB PNG declaring
 * 20000x10000 allocate hundreds of MB before we ever see it.
 */
const LIMIT_INPUT_PIXELS = 50_000_000;

const BLOB_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Carries the status the route should answer with. */
export class ReviewImageError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ReviewImageError";
    this.status = status;
  }
}

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export interface ReviewImageUpload {
  file: File;
  caption: string | null;
}

/**
 * What the upload's EXIF claimed, harvested before the re-encode drops it.
 * Uploader-controlled data — anything here is a hint, never a fact.
 */
export interface ReviewPhotoExif {
  takenAt: Date | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ProcessedReviewImage {
  url: string;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
  exif: ReviewPhotoExif;
  /** Great-circle km between the tagged position and the airport, if both known. */
  gpsDistanceKm: number | null;
}

const EMPTY_EXIF: ReviewPhotoExif = { takenAt: null, latitude: null, longitude: null };

/** EXIF stores coordinates as [degrees, minutes, seconds] plus a N/S/E/W ref. */
function dmsToDecimal(dms: unknown, ref: unknown): number | null {
  if (!Array.isArray(dms) || dms.length < 3) {
    return null;
  }

  const [degrees, minutes, seconds] = dms.map(Number);

  if (![degrees, minutes, seconds].every(Number.isFinite)) {
    return null;
  }

  const magnitude = degrees + minutes / 60 + seconds / 3600;
  const negative = typeof ref === "string" && /^[SW]/i.test(ref.trim());

  return negative ? -magnitude : magnitude;
}

/**
 * Pull capture time and coordinates out of an upload. Never throws: a corrupt
 * or absent EXIF block is the normal case (iOS strips location on share unless
 * the user opts in, and screenshots never had any), not a reason to reject a
 * photo.
 */
export function readReviewPhotoExif(exif: Buffer | undefined): ReviewPhotoExif {
  if (!exif) {
    return EMPTY_EXIF;
  }

  try {
    const parsed = exifReader(exif);
    const takenAt = parsed.Photo?.DateTimeOriginal;
    const latitude = dmsToDecimal(
      parsed.GPSInfo?.GPSLatitude,
      parsed.GPSInfo?.GPSLatitudeRef,
    );
    const longitude = dmsToDecimal(
      parsed.GPSInfo?.GPSLongitude,
      parsed.GPSInfo?.GPSLongitudeRef,
    );

    const inRange =
      latitude !== null &&
      longitude !== null &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180 &&
      // Exactly (0, 0) is Null Island — the signature of a zeroed GPS block,
      // not a photo taken in the Gulf of Guinea.
      !(latitude === 0 && longitude === 0);

    return {
      takenAt: takenAt instanceof Date && !Number.isNaN(takenAt.getTime()) ? takenAt : null,
      latitude: inRange ? latitude : null,
      longitude: inRange ? longitude : null,
    };
  } catch {
    return EMPTY_EXIF;
  }
}

function distanceToAirportKm(iata: string, exif: ReviewPhotoExif): number | null {
  if (exif.latitude === null || exif.longitude === null) {
    return null;
  }

  const airport = getAirportByIata(iata);

  if (!airport) {
    return null;
  }

  return haversineKm(exif.latitude, exif.longitude, airport.latitude, airport.longitude);
}

/**
 * Cheap pre-flight on untrusted metadata, so obviously-bad submissions are
 * rejected before we spend any CPU decoding them. Returns a message to show the
 * poster, or null when the batch looks fine.
 */
export function validateReviewImageUploads(
  uploads: ReviewImageUpload[],
): string | null {
  if (uploads.length > MAX_REVIEW_IMAGES) {
    return `Attach at most ${MAX_REVIEW_IMAGES} photos.`;
  }

  for (const { file, caption } of uploads) {
    if (file.size === 0) {
      return `"${file.name}" is empty.`;
    }

    if (file.size > MAX_UPLOAD_BYTES_PER_FILE) {
      return `"${file.name}" is larger than ${Math.round(
        MAX_UPLOAD_BYTES_PER_FILE / (1024 * 1024),
      )} MB.`;
    }

    if (!ALLOWED_UPLOAD_MIME.has(file.type)) {
      return `"${file.name}" isn't a supported image (JPEG, PNG, WebP or AVIF).`;
    }

    if (caption && caption.length > MAX_REVIEW_CAPTION_LENGTH) {
      return `Keep photo captions under ${MAX_REVIEW_CAPTION_LENGTH} characters.`;
    }
  }

  return null;
}

function fallbackAlt(iata: string, index: number, total: number): string {
  return total > 1
    ? `Traveler photo of ${iata} airport (${index + 1} of ${total})`
    : `Traveler photo of ${iata} airport`;
}

function unsupportedFormatMessage(name: string): string {
  return `"${name}" isn't a supported image (JPEG, PNG, WebP or AVIF).`;
}

function tooManyPixelsMessage(name: string): string {
  return `"${name}" is too large to process (over ${Math.round(
    LIMIT_INPUT_PIXELS / 1_000_000,
  )} megapixels).`;
}

/**
 * Decode an untrusted upload and re-encode it as a modestly sized WebP. This is
 * where EXIF (including GPS) goes away: nothing is copied across unless we ask
 * for it, and we never do.
 */
export async function normalizeReviewPhoto(
  file: File,
): Promise<{ data: Buffer; width: number; height: number; exif: ReviewPhotoExif }> {
  const input = Buffer.from(await file.arrayBuffer());
  const pipeline = sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS });

  // sharp refuses to even describe an image past limitInputPixels, so the
  // oversized case surfaces here rather than at encode time.
  let metadata;
  try {
    metadata = await pipeline.metadata();
  } catch (error) {
    throw new ReviewImageError(
      (error as Error).message.includes("pixel limit")
        ? tooManyPixelsMessage(file.name)
        : unsupportedFormatMessage(file.name),
    );
  }

  if (!metadata.format || !ALLOWED_SHARP_FORMATS.has(metadata.format)) {
    throw new ReviewImageError(unsupportedFormatMessage(file.name));
  }

  if ((metadata.width ?? 0) * (metadata.height ?? 0) > LIMIT_INPUT_PIXELS) {
    throw new ReviewImageError(tooManyPixelsMessage(file.name));
  }

  const webp = await pipeline
    // Bake in EXIF orientation before the re-encode drops all metadata,
    // otherwise portrait phone photos come back sideways.
    .rotate()
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    // No .withMetadata(), so EXIF/GPS never reaches the blob store.
    .toBuffer({ resolveWithObject: true });

  return {
    data: webp.data,
    width: webp.info.width,
    height: webp.info.height,
    // Harvested from the original, which is the only place it still exists.
    exif: readReviewPhotoExif(metadata.exif),
  };
}

/**
 * Re-encode each upload to WebP and push it to Blob, in order, one at a time
 * (concurrent sharp decodes multiply peak memory for no wall-clock win on a
 * handful of photos).
 *
 * Throws `ReviewImageError` if any photo can't be processed — a submission is
 * all-or-nothing, since silently dropping a photo the poster picked reads as a
 * bug. Anything already uploaded is deleted before the throw propagates. The
 * caller still owns cleanup if the *database* write then fails.
 */
export async function processAndUploadReviewImages({
  iata,
  reviewId,
  uploads,
}: {
  iata: string;
  reviewId: string;
  uploads: ReviewImageUpload[];
}): Promise<ProcessedReviewImage[]> {
  const processed: ProcessedReviewImage[] = [];

  try {
    for (const [index, upload] of uploads.entries()) {
      const webp = await normalizeReviewPhoto(upload.file);

      const blob = await put(
        `reviews/${iata.toLowerCase()}/${reviewId}/${index}.webp`,
        webp.data,
        {
          access: "public",
          contentType: "image/webp",
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: BLOB_CACHE_MAX_AGE_SECONDS,
        },
      );

      processed.push({
        url: blob.url,
        alt: upload.caption ?? fallbackAlt(iata, index, uploads.length),
        caption: upload.caption,
        width: webp.width,
        height: webp.height,
        exif: webp.exif,
        gpsDistanceKm: distanceToAirportKm(iata, webp.exif),
      });
    }
  } catch (error) {
    await deleteReviewImageBlobs(processed.map((image) => image.url));
    throw error;
  }

  return processed;
}

/** Best-effort cleanup; a leaked blob must never turn into a failed request. */
export async function deleteReviewImageBlobs(urls: string[]): Promise<void> {
  if (urls.length === 0) {
    return;
  }

  try {
    await del(urls);
  } catch (error) {
    console.error("Failed to clean up review image blobs:", error);
  }
}

export function rowToReviewImage(row: AirportReviewImageRow): ReviewImage {
  return {
    id: row.id,
    url: row.url,
    alt: row.alt,
    caption: row.caption ?? undefined,
    width: row.width,
    height: row.height,
  };
}

export async function fetchReviewImageRows(
  reviewIds: string[],
): Promise<AirportReviewImageRow[]> {
  if (reviewIds.length === 0 || !isDatabaseConfigured()) {
    return [];
  }

  return getDb()
    .select()
    .from(airportReviewImages)
    .where(inArray(airportReviewImages.reviewId, reviewIds))
    .orderBy(asc(airportReviewImages.reviewId), asc(airportReviewImages.sortOrder));
}
