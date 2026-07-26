import { checkBotId } from "botid/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";
import { reviewFormSchema } from "@/lib/review-schema";
import { updateReview } from "@/lib/reviews";
import { assertSameOrigin } from "@/lib/request-security";

interface RouteParams {
  params: Promise<{ iata: string; reviewId: string }>;
}

function normalizeIata(iata: string): string | null {
  const normalized = iata.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { iata, reviewId } = await params;
  const normalized = normalizeIata(iata);

  if (!normalized || !isUuid(reviewId)) {
    return NextResponse.json({ error: "Invalid review" }, { status: 400 });
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
    return NextResponse.json({ error: "Sign in to edit your review." }, { status: 401 });
  }

  if (verification.isBot) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = reviewFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid review", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (parsed.data.website) {
    return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  }

  try {
    const review = await updateReview({
      id: reviewId,
      iata: normalized,
      userId: session.user.id,
      values: parsed.data,
    });

    if (!review) {
      // The same response covers a missing review and one owned by somebody
      // else, so this endpoint does not become an ownership oracle.
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ review });
  } catch (error) {
    console.error(`Failed to update review ${reviewId} for ${normalized}:`, error);
    return NextResponse.json(
      { error: "Reviews are temporarily unavailable" },
      { status: 503 },
    );
  }
}
