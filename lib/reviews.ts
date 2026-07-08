import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { airportReviews, type AirportReviewRow } from "@/lib/db/schema";
import type { AirportUserReview, ReviewFormValues } from "@/lib/review-schema";

const MAX_REVIEWS_LISTED = 50;
const MAX_REVIEWS_PER_IP_PER_HOUR = 5;

function toAirportUserReview(row: AirportReviewRow): AirportUserReview {
  return {
    id: row.id,
    author: row.author,
    tripType: row.tripType,
    rating: row.rating,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getReviewsByIata(iata: string): Promise<AirportUserReview[]> {
  const rows = await getDb()
    .select()
    .from(airportReviews)
    .where(
      and(
        eq(airportReviews.iata, iata),
        eq(airportReviews.status, "published"),
        eq(airportReviews.source, "community"),
      ),
    )
    .orderBy(desc(airportReviews.createdAt))
    .limit(MAX_REVIEWS_LISTED);

  return rows.map(toAirportUserReview);
}

/** Curated reviews seeded from our own scoring/editorial process, shown as a separate lane. */
export async function getEditorialReviewsByIata(iata: string): Promise<AirportUserReview[]> {
  const rows = await getDb()
    .select()
    .from(airportReviews)
    .where(
      and(
        eq(airportReviews.iata, iata),
        eq(airportReviews.status, "published"),
        eq(airportReviews.source, "editorial"),
      ),
    )
    .orderBy(desc(airportReviews.createdAt))
    .limit(MAX_REVIEWS_LISTED);

  return rows.map(toAirportUserReview);
}

export async function createReview(
  iata: string,
  values: ReviewFormValues,
  ipHash: string | null,
): Promise<AirportUserReview | "rate-limited"> {
  const db = getDb();

  if (ipHash) {
    const [recent] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(airportReviews)
      .where(
        and(
          eq(airportReviews.ipHash, ipHash),
          gt(airportReviews.createdAt, sql`now() - interval '1 hour'`),
        ),
      );

    if ((recent?.count ?? 0) >= MAX_REVIEWS_PER_IP_PER_HOUR) {
      return "rate-limited";
    }
  }

  const [row] = await db
    .insert(airportReviews)
    .values({
      iata,
      author: values.author,
      tripType: values.tripType,
      rating: values.rating,
      title: values.title,
      body: values.body,
      ipHash,
    })
    .returning();

  return toAirportUserReview(row);
}
