import assert from "node:assert/strict";
import test from "node:test";
import {
  initialReviewsState,
  shouldClientFetchReviews,
} from "@/app/components/airport-reviews-state";
import type { AirportUserReview } from "@/lib/review-schema";

const sampleReview: AirportUserReview = {
  id: "rev_1",
  author: "Ada",
  tripType: "Leisure",
  rating: 4,
  title: "Fine for a connection",
  body: "Security moved, food did not.",
  createdAt: "2026-08-01T12:00:00.000Z",
  images: [],
};

test("review list hydrates from a server snapshot without a client fetch", () => {
  assert.deepEqual(initialReviewsState(), { status: "loading" });
  assert.deepEqual(initialReviewsState(undefined, true), { status: "unavailable" });
  assert.deepEqual(initialReviewsState([]), { status: "ready", reviews: [] });
  assert.deepEqual(initialReviewsState([sampleReview]), {
    status: "ready",
    reviews: [sampleReview],
  });

  assert.equal(shouldClientFetchReviews(0, true), false);
  assert.equal(shouldClientFetchReviews(0, false), true);
  assert.equal(shouldClientFetchReviews(1, true), true);
});
