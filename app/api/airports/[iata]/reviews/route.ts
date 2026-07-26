import { randomUUID } from "node:crypto";
import { checkBotId } from "botid/server";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db";
import {
  deleteReviewImageBlobs,
  isBlobConfigured,
  processAndUploadReviewImages,
  ReviewImageError,
  validateReviewImageUploads,
  type ReviewImageUpload,
} from "@/lib/review-images";
import { reviewFormSchema } from "@/lib/review-schema";
import { createReview, getReviewsByIata, isReviewRateLimited } from "@/lib/reviews";
import { assertSameOrigin, hashClientIp } from "@/lib/request-security";

interface RouteParams {
  params: Promise<{ iata: string }>;
}

/**
 * Set by our own form on multipart submissions. `application/json` is itself a
 * CSRF barrier (it forces a preflight), but `multipart/form-data` is a
 * CORS-simple content type that a cross-site HTML form could post without one —
 * and such a form cannot set a custom header, so this restores the guarantee.
 */
const FORM_HEADER = "x-honestairport-form";

interface ReviewSubmission {
  fields: unknown;
  uploads: ReviewImageUpload[];
}

function normalizeIata(iata: string): string | null {
  const normalized = iata.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function isMultipart(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").startsWith("multipart/form-data");
}

/**
 * The form posts multipart so photos ride along with the review in one atomic
 * request; JSON is still accepted so the endpoint stays curl-able for ops.
 */
async function readSubmission(request: Request): Promise<ReviewSubmission> {
  if (!isMultipart(request)) {
    return { fields: await request.json(), uploads: [] };
  }

  const form = await request.formData();
  const captions = form.getAll("photoCaptions");
  const uploads = form
    .getAll("photos")
    .filter((value): value is File => value instanceof File)
    .map((file, index) => {
      const caption = captions[index];
      const trimmed = typeof caption === "string" ? caption.trim() : "";

      return { file, caption: trimmed.length > 0 ? trimmed : null };
    });

  const text = (key: string): string => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };

  return {
    fields: {
      author: text("author"),
      tripType: text("tripType"),
      // Number("") is 0 and Number(null) is NaN — both fail the schema with the
      // existing "Pick a star rating." message, so the shared zod schema (also
      // the client resolver, where rating is a real number) stays untouched.
      rating: Number(form.get("rating")),
      title: text("title"),
      body: text("body"),
      website: text("website"),
    },
    uploads,
  };
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

  if (isMultipart(request) && request.headers.get(FORM_HEADER) !== "1") {
    return NextResponse.json({ error: "Invalid request" }, { status: 403 });
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

  // Reading the body buffers it entirely, so every gate above stays ahead of it.
  let submission: ReviewSubmission;
  try {
    submission = await readSubmission(request);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = reviewFormSchema.safeParse(submission.fields);

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

  const ipHash = hashClientIp(request);

  // Before any image work: a rate-limited caller must not leave blobs behind.
  try {
    if (await isReviewRateLimited(ipHash)) {
      return NextResponse.json(
        { error: "Too many reviews submitted — try again in an hour." },
        { status: 429 },
      );
    }
  } catch (error) {
    console.error(`Failed to check review rate limit for ${normalized}:`, error);
    return NextResponse.json(
      { error: "Reviews are temporarily unavailable" },
      { status: 503 },
    );
  }

  const { uploads } = submission;

  if (uploads.length > 0) {
    if (!isBlobConfigured()) {
      return NextResponse.json(
        { error: "Photo uploads aren't configured." },
        { status: 503 },
      );
    }

    const uploadError = validateReviewImageUploads(uploads);

    if (uploadError) {
      return NextResponse.json({ error: uploadError }, { status: 400 });
    }
  }

  const reviewId = randomUUID();
  let images;

  try {
    images =
      uploads.length > 0
        ? await processAndUploadReviewImages({ iata: normalized, reviewId, uploads })
        : [];
  } catch (error) {
    if (error instanceof ReviewImageError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(`Failed to upload review photos for ${normalized}:`, error);
    return NextResponse.json(
      { error: "Couldn't process those photos — try again." },
      { status: 502 },
    );
  }

  try {
    const review = await createReview({
      id: reviewId,
      iata: normalized,
      values: parsed.data,
      ipHash,
      userId: session.user.id,
      images,
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error(`Failed to create review for ${normalized}:`, error);
    // The blobs are already up but nothing references them — don't leak them.
    await deleteReviewImageBlobs(images.map((image) => image.url));
    return NextResponse.json(
      { error: "Reviews are temporarily unavailable" },
      { status: 503 },
    );
  }
}
