import { headers } from "next/headers";
import { AirportReviews } from "@/app/components/airport-reviews";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { getReviewsByIata } from "@/lib/reviews";
import type { AirportUserReview } from "@/lib/review-schema";

export async function AirportReviewsFromServer({
  iata,
  seedReviews = [],
  className,
}: {
  iata: string;
  seedReviews?: AirportUserReview[];
  className?: string;
}) {
  if (!isDatabaseConfigured()) {
    return (
      <AirportReviews
        iata={iata}
        seedReviews={seedReviews}
        initialUnavailable
        className={className}
      />
    );
  }

  try {
    const sessionPromise = auth.api
      .getSession({ headers: await headers() })
      .then((session) => session?.user.id ?? null);
    const reviews = await getReviewsByIata(iata, sessionPromise);
    return (
      <AirportReviews
        iata={iata}
        seedReviews={seedReviews}
        initialReviews={reviews}
        className={className}
      />
    );
  } catch {
    return (
      <AirportReviews iata={iata} seedReviews={seedReviews} className={className} />
    );
  }
}
