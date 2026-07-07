#!/usr/bin/env tsx
/**
 * Poll the frequent-flyer community forum RSS and queue airport page updates.
 *
 * Usage:
 *   pnpm sync:forum
 *   pnpm sync:forum --review          # sync, then review changed airports
 *   pnpm sync:forum --reset           # forget seen items (re-detect all RSS entries)
 */

import { listAirportGuideIatas } from "../lib/airport-guides";
import {
  loadCommunityForumState,
  saveCommunityForumState,
  syncCommunityForumFeed,
} from "../lib/community-forum-sync";
import { reviewAirportsFromQueue } from "./review-airport-pages";

async function main() {
  const args = process.argv.slice(2);
  const shouldReview = args.includes("--review");
  const shouldReset = args.includes("--reset");

  if (shouldReset) {
    await saveCommunityForumState({
      syncedAt: "",
      seenItems: {},
      pending: [],
      referenceActivity: [],
    });
    console.log("Reset community forum sync state.");
  }

  const knownIatas = await listAirportGuideIatas();
  if (knownIatas.length === 0) {
    console.log("No airport guides found in the database.");
    process.exit(0);
  }

  const hadState = Boolean((await loadCommunityForumState()).syncedAt);
  const result = await syncCommunityForumFeed(knownIatas, { baselineOnly: !hadState });

  if (!hadState) {
    console.log(
      `Initialized sync state with ${Object.keys(result.state.seenItems).length} RSS items (baseline — no reviews queued).`,
    );
    console.log("Run again after new forum posts appear, or use --reset to re-queue.");
    process.exit(0);
  }

  if (result.newItems === 0) {
    console.log("No new forum activity since last sync.");
  } else {
    console.log(`Detected ${result.newItems} updated thread(s).`);
    if (result.changedAirports.length > 0) {
      console.log(`Queued for review: ${result.changedAirports.join(", ")}`);
    } else {
      console.log("No matches for airports with guides in the database.");
    }

    if (result.referenceActivity.length > 0) {
      console.log(
        `Reference thread updates (${result.referenceActivity.length}) attached to queued airport reviews.`,
      );
    }
  }

  if (shouldReview) {
    if (result.state.pending.length === 0) {
      console.log("Nothing to review.");
      process.exit(0);
    }

    await reviewAirportsFromQueue();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
