/**
 * Lounge image domain logic: types and raw (uncached) Postgres access for
 * `airport_lounge_images`. Next-free on purpose — the lounge image sync
 * script runs it directly via tsx, mirroring `lib/airport-images.ts`.
 *
 * App code should read through `getAirportLoungeImages` in
 * `lib/airport-content.ts`, which wraps these reads in Next's data cache.
 */
import { and, asc, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "./db";
import { airportLoungeImages, type AirportLoungeImageRow } from "./db/schema";
import type { AirportImage, NewAirportImage } from "./airport-images";

export function loungeImageRowToAirportImage(row: AirportLoungeImageRow): AirportImage {
  return {
    url: row.url,
    alt: row.alt,
    caption: row.caption ?? undefined,
    credit: row.credit,
    license: row.license,
    licenseUrl: row.licenseUrl ?? undefined,
    sourceUrl: row.sourceUrl,
    width: row.width,
    height: row.height,
  };
}

export async function fetchLoungeImageRows(
  iata: string,
  loungeSlug: string,
): Promise<AirportLoungeImageRow[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  return getDb()
    .select()
    .from(airportLoungeImages)
    .where(
      and(
        eq(airportLoungeImages.iata, iata.toUpperCase()),
        eq(airportLoungeImages.loungeSlug, loungeSlug),
      ),
    )
    .orderBy(asc(airportLoungeImages.sortOrder), asc(airportLoungeImages.createdAt));
}

export async function fetchAllLoungeImageRowsForAirport(
  iata: string,
): Promise<AirportLoungeImageRow[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  return getDb()
    .select()
    .from(airportLoungeImages)
    .where(eq(airportLoungeImages.iata, iata.toUpperCase()))
    .orderBy(asc(airportLoungeImages.loungeSlug), asc(airportLoungeImages.sortOrder));
}

/**
 * Replace one lounge's image set atomically and return blob URLs no longer
 * referenced (so the caller can delete orphaned blobs). Lounges the sync
 * found no photos for are left untouched by simply not calling this.
 */
export async function replaceLoungeImages(
  iata: string,
  loungeSlug: string,
  images: NewAirportImage[],
): Promise<{ orphanedUrls: string[] }> {
  const normalizedIata = iata.toUpperCase();
  const db = getDb();

  return db.transaction(async (tx) => {
    const previous = await tx
      .select({ url: airportLoungeImages.url })
      .from(airportLoungeImages)
      .where(
        and(
          eq(airportLoungeImages.iata, normalizedIata),
          eq(airportLoungeImages.loungeSlug, loungeSlug),
        ),
      );

    await tx
      .delete(airportLoungeImages)
      .where(
        and(
          eq(airportLoungeImages.iata, normalizedIata),
          eq(airportLoungeImages.loungeSlug, loungeSlug),
        ),
      );

    if (images.length > 0) {
      await tx.insert(airportLoungeImages).values(
        images.map((image, index) => ({
          iata: normalizedIata,
          loungeSlug,
          url: image.url,
          alt: image.alt,
          caption: image.caption ?? null,
          credit: image.credit,
          license: image.license,
          licenseUrl: image.licenseUrl ?? null,
          sourceUrl: image.sourceUrl,
          width: image.width,
          height: image.height,
          sortOrder: index,
        })),
      );
    }

    const kept = new Set(images.map((image) => image.url));
    return { orphanedUrls: previous.map((row) => row.url).filter((url) => !kept.has(url)) };
  });
}
