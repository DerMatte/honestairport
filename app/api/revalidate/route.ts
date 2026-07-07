import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { AIRPORT_GUIDES_CACHE_TAG } from "@/lib/airport-content";

/**
 * Called by the content pipeline after upserting guides in Postgres so
 * updates go live immediately instead of waiting for timed revalidation.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret?.trim()) {
    return NextResponse.json({ error: "Revalidation is not configured" }, { status: 503 });
  }

  if (request.headers.get("x-revalidate-secret") !== secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  // { expire: 0 } = immediate expiration, the documented pattern for
  // revalidation triggered by external systems via route handlers.
  revalidateTag(AIRPORT_GUIDES_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ revalidated: true, tag: AIRPORT_GUIDES_CACHE_TAG });
}
