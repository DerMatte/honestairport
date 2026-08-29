import type { AirportUserReview } from "@/lib/review-schema";

export type ReviewsState =
  | { status: "loading" }
  | { status: "ready"; reviews: AirportUserReview[] }
  | { status: "error"; error: string }
  | { status: "unavailable" };

export function initialReviewsState(
  initialReviews?: AirportUserReview[],
  initialUnavailable = false,
): ReviewsState {
  if (initialUnavailable) {
    return { status: "unavailable" };
  }
  if (initialReviews !== undefined) {
    return { status: "ready", reviews: initialReviews };
  }
  return { status: "loading" };
}

/** Skip the mount-time fetch when the server already supplied a snapshot. */
export function shouldClientFetchReviews(
  reloadKey: number,
  hasServerSnapshot: boolean,
): boolean {
  return reloadKey > 0 || !hasServerSnapshot;
}
