import { checkBotId } from "botid/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { reviewFormSchema } from "@/lib/review-schema";
import { createReview, getReviewsByIata } from "@/lib/reviews";
import { assertSameOrigin, hashClientIp } from "@/lib/request-security";

interface RouteParams {
  params: Promise<{ iata: string }>;
}

function normalizeIata(iata: string): string | null {
  const normalized = iata.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { iata } = await params;
  const normalized = normalizeIata(iata);

  if (!normalized) {
    return NextResponse.json({ error: "Invalid IATA code" }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Reviews are not configured" }, { status: 503 });
  }

  try {
    const reviews = await getReviewsByIata(normalized);

    return NextResponse.json(
      { reviews },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(`Failed to load reviews for ${normalized}:`, error);
    return NextResponse.json(
      { error: "Reviews are temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const { iata } = await params;
  const normalized = normalizeIata(iata);

  if (!normalized) {
    return NextResponse.json({ error: "Invalid IATA code" }, { status: 400 });
  }

  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Reviews are not configured" }, { status: 503 });
  }

  const [session, verification] = await Promise.all([
    auth.api.getSession({ headers: request.headers }),
    checkBotId(),
  ]);

  if (!session) {
    return NextResponse.json({ error: "Sign in to post reviews." }, { status: 401 });
  }

  if (!isAdmin(session.user)) {
    return NextResponse.json(
      { error: "Only admins can post reviews." },
      { status: 403 },
    );
  }

  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reviewFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid review", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Honeypot tripped: pretend success so bots don't learn they were caught.
  if (parsed.data.website) {
    return NextResponse.json({ review: null }, { status: 201 });
  }

  try {
    const result = await createReview(
      normalized,
      parsed.data,
      hashClientIp(request),
      session.user.id,
    );

    if (result === "rate-limited") {
      return NextResponse.json(
        { error: "Too many reviews submitted — try again in an hour." },
        { status: 429 },
      );
    }

    return NextResponse.json({ review: result }, { status: 201 });
  } catch (error) {
    console.error(`Failed to create review for ${normalized}:`, error);
    return NextResponse.json(
      { error: "Reviews are temporarily unavailable" },
      { status: 503 },
    );
  }
}
