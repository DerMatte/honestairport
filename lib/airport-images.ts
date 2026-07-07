/**
 * Airport image domain logic: types and raw (uncached) Postgres access.
 * Next-free on purpose — the image sync script runs it directly via tsx,
 * mirroring the split between `lib/airport-guides.ts` and
 * `lib/airport-content.ts`.
 *
 * App code should read through `getAirportImages` in `lib/airport-content.ts`,
 * which wraps these reads in Next's data cache with revalidation tags.
 */
import { asc, eq, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "./db";
import { airportImages, type AirportImageRow } from "./db/schema";

export interface AirportImage {
  url: string;
  alt: string;
  caption?: string;
  credit: string;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
  width: number;
  height: number;
}

export function rowToAirportImage(row: AirportImageRow): AirportImage {
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

export async function fetchAirportImageRows(iata: string): Promise<AirportImageRow[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  return getDb()
    .select()
    .from(airportImages)
    .where(eq(airportImages.iata, iata.toUpperCase()))
    .orderBy(asc(airportImages.sortOrder), asc(airportImages.createdAt));
}

/** Image count per IATA, for picking which airport the sync works on next. */
export async function fetchAirportImageCounts(): Promise<Map<string, number>> {
  if (!isDatabaseConfigured()) {
    return new Map();
  }

  const rows = await getDb()
    .select({ iata: airportImages.iata, count: sql<number>`count(*)::int` })
    .from(airportImages)
    .groupBy(airportImages.iata);

  return new Map(rows.map((row) => [row.iata.toUpperCase(), row.count]));
}

export interface NewAirportImage {
  url: string;
  alt: string;
  caption?: string;
  credit: string;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
  width: number;
  height: number;
}

/**
 * Replace an airport's image set atomically and return the blob URLs that
 * are no longer referenced (so the caller can delete the orphaned blobs).
 */
export async function replaceAirportImages(
  iata: string,
  images: NewAirportImage[],
): Promise<{ orphanedUrls: string[] }> {
  const normalizedIata = iata.toUpperCase();
  const db = getDb();

  return db.transaction(async (tx) => {
    const previous = await tx
      .select({ url: airportImages.url })
      .from(airportImages)
      .where(eq(airportImages.iata, normalizedIata));

    await tx.delete(airportImages).where(eq(airportImages.iata, normalizedIata));

    if (images.length > 0) {
      await tx.insert(airportImages).values(
        images.map((image, index) => ({
          iata: normalizedIata,
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
