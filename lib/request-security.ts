import { and, eq, sql } from "drizzle-orm";
import { createHash, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { rateLimitBuckets } from "@/lib/db/schema";
import { SITE_URL } from "@/lib/site";

/** First trusted proxy hop, hashed so raw IPs are never stored. */
export function hashClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim();

  if (!ip) {
    return null;
  }

  return createHash("sha256").update(ip).digest("hex");
}

/**
 * Reject cross-site state-changing requests. Allows same-origin browser
 * fetches and non-browser callers that omit Origin (e.g. curl with a secret).
 */
export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const allowed = new Set<string>();

  try {
    allowed.add(new URL(SITE_URL).origin);
  } catch {
    // SITE_URL misconfigured — fall through to request URL / auth URL.
  }

  const authUrl = process.env.BETTER_AUTH_URL?.trim();
  if (authUrl) {
    try {
      allowed.add(new URL(authUrl).origin);
    } catch {
      // ignore invalid BETTER_AUTH_URL
    }
  }

  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    // ignore
  }

  return allowed.has(origin);
}

/** Constant-time compare for equal-length secrets; length mismatch fails closed. */
export function secretsEqual(provided: string | null, expected: string): boolean {
  if (!provided) {
    return false;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

/**
 * Sliding fixed-window counter stored in Postgres so limits survive serverless
 * instance churn. Returns false when the caller is over the limit.
 */
export async function consumeRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const db = getDb();
  const windowStartCutoff = new Date(Date.now() - windowMs);

  const [existing] = await db
    .select()
    .from(rateLimitBuckets)
    .where(eq(rateLimitBuckets.bucketKey, bucketKey))
    .limit(1);

  if (!existing || existing.windowStartsAt < windowStartCutoff) {
    await db
      .insert(rateLimitBuckets)
      .values({
        bucketKey,
        count: 1,
        windowStartsAt: new Date(),
      })
      .onConflictDoUpdate({
        target: rateLimitBuckets.bucketKey,
        set: {
          count: 1,
          windowStartsAt: new Date(),
        },
      });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  await db
    .update(rateLimitBuckets)
    .set({ count: sql`${rateLimitBuckets.count} + 1` })
    .where(eq(rateLimitBuckets.bucketKey, bucketKey));

  return true;
}
