"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, RefreshCw, Star } from "lucide-react";
import { isAdmin } from "@/lib/admin";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  TRIP_TYPES,
  reviewFormSchema,
  type AirportUserReview,
  type ReviewFormValues,
} from "@/lib/review-schema";

interface AirportReviewsProps {
  iata: string;
  /** Editorial seed reviews shown after community ones. */
  seedReviews?: AirportUserReview[];
  showHeading?: boolean;
  className?: string;
}

type ReviewsState =
  | { status: "loading" }
  | { status: "ready"; reviews: AirportUserReview[] }
  | { status: "error"; error: string }
  | { status: "unavailable" };

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1 text-sm">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "size-4",
            index < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function ReviewCard({
  author,
  meta,
  rating,
  title,
  body,
}: {
  author: string;
  meta: string;
  rating: number;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {author} · {meta}
            </div>
          </div>
          <StarRow rating={rating} />
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}

function RatingPicker({
  value,
  onChange,
  invalid,
}: {
  value: number;
  onChange: (rating: number) => void;
  invalid: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Star rating"
      className={cn(
        "flex items-center gap-1 rounded-lg py-1",
        invalid && "ring-3 ring-destructive/20",
      )}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange(star)}
          className="rounded-md p-0.5 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Star
            className={cn(
              "size-6",
              star <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
            )}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({
  iata,
  onCreated,
}: {
  iata: string;
  onCreated: (review: AirportUserReview) => void;
}) {
  const { data: session, isPending } = useSession();
  const [submitState, setSubmitState] = useState<
    | { status: "idle" }
    | { status: "success" }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: { author: "", title: "", body: "", rating: 0, website: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitState({ status: "idle" });

    try {
      const response = await fetch(`/api/airports/${encodeURIComponent(iata)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          payload?.error ??
            (response.status === 429
              ? "Too many reviews submitted — try again later."
              : "Something went wrong submitting your review."),
        );
      }

      const payload = (await response.json()) as { review: AirportUserReview | null };

      if (payload.review) {
        onCreated(payload.review);
      }

      reset();
      setSubmitState({ status: "success" });
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Something went wrong submitting your review.",
      });
    }
  });

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Write a review</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const canPost = Boolean(session && isAdmin(session.user));

  if (!canPost) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Write a review</CardTitle>
          <p className="text-xs text-muted-foreground">
            {session ? (
              <>
                Signed in as {session.user.email}. Review publishing is limited to
                admins for now.
              </>
            ) : (
              <>
                Reviews are published by site admins —{" "}
                <Link href="/login" className="underline underline-offset-4">
                  sign in
                </Link>
                .
              </>
            )}
          </p>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Write a review</CardTitle>
        <p className="text-xs text-muted-foreground">
          Signed in as {session!.user.email}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`review-author-${iata}`}>Name</Label>
              <Input
                id={`review-author-${iata}`}
                placeholder="e.g. Maya K."
                aria-invalid={Boolean(errors.author)}
                {...register("author")}
              />
              {errors.author ? (
                <p className="text-xs text-destructive">{errors.author.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`review-trip-type-${iata}`}>Trip type</Label>
              <Controller
                control={control}
                name="tripType"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger
                      id={`review-trip-type-${iata}`}
                      className="w-full"
                      aria-invalid={Boolean(errors.tripType)}
                    >
                      <SelectValue placeholder="Select trip type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIP_TYPES.map((tripType) => (
                        <SelectItem key={tripType} value={tripType}>
                          {tripType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tripType ? (
                <p className="text-xs text-destructive">{errors.tripType.message}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Rating</Label>
            <Controller
              control={control}
              name="rating"
              render={({ field }) => (
                <RatingPicker
                  value={field.value}
                  onChange={field.onChange}
                  invalid={Boolean(errors.rating)}
                />
              )}
            />
            {errors.rating ? (
              <p className="text-xs text-destructive">{errors.rating.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`review-title-${iata}`}>Title</Label>
            <Input
              id={`review-title-${iata}`}
              placeholder="Sum up your experience"
              aria-invalid={Boolean(errors.title)}
              {...register("title")}
            />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`review-body-${iata}`}>Review</Label>
            <Textarea
              id={`review-body-${iata}`}
              placeholder="Security waits, signage, food, what you wish you'd known…"
              aria-invalid={Boolean(errors.body)}
              {...register("body")}
            />
            {errors.body ? (
              <p className="text-xs text-destructive">{errors.body.message}</p>
            ) : null}
          </div>

          {/* Honeypot — visually hidden from humans, tempting for bots. */}
          <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor={`review-website-${iata}`}>Website</label>
            <input
              id={`review-website-${iata}`}
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...register("website")}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting…" : "Post review"}
            </Button>
            {submitState.status === "success" ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
                Thanks — your review is live.
              </p>
            ) : null}
            {submitState.status === "error" ? (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="size-4" aria-hidden="true" />
                {submitState.message}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function AirportReviews({
  iata,
  seedReviews = [],
  showHeading = false,
  className,
}: AirportReviewsProps) {
  const [state, setState] = useState<ReviewsState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadReviews() {
      setState({ status: "loading" });

      try {
        const response = await fetch(`/api/airports/${encodeURIComponent(iata)}/reviews`, {
          signal: controller.signal,
        });

        if (response.status === 503) {
          setState({ status: "unavailable" });
          return;
        }

        if (!response.ok) {
          throw new Error(`Reviews request failed (${response.status})`);
        }

        const payload = (await response.json()) as { reviews: AirportUserReview[] };
        setState({ status: "ready", reviews: payload.reviews });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load traveler reviews.",
        });
      }
    }

    loadReviews();

    return () => {
      controller.abort();
    };
  }, [iata, reloadKey]);

  const handleCreated = useCallback((review: AirportUserReview) => {
    setState((current) =>
      current.status === "ready"
        ? { status: "ready", reviews: [review, ...current.reviews] }
        : { status: "ready", reviews: [review] },
    );
  }, []);

  const summary = useMemo(() => {
    if (state.status !== "ready" || state.reviews.length === 0) {
      return null;
    }

    const average =
      state.reviews.reduce((total, review) => total + review.rating, 0) / state.reviews.length;

    return { count: state.reviews.length, average };
  }, [state]);

  if (state.status === "unavailable" && seedReviews.length === 0) {
    return null;
  }

  return (
    <section className={cn("space-y-4", className)} aria-label="Traveler reviews">
      {showHeading ? (
        <div>
          <p className="text-sm font-medium text-primary">Traveler reviews</p>
          <h2 className="text-2xl font-semibold tracking-tight">What travelers say</h2>
        </div>
      ) : null}

      {state.status !== "unavailable" ? (
        <ReviewForm iata={iata} onCreated={handleCreated} />
      ) : null}

      {summary ? (
        <p className="text-sm text-muted-foreground">
          {summary.count} community {summary.count === 1 ? "review" : "reviews"} · average{" "}
          {summary.average.toFixed(1)}/5
        </p>
      ) : null}

      {state.status === "loading" ? (
        <div className="space-y-4">
          {[0, 1].map((item) => (
            <div key={item} className="rounded-2xl border bg-card p-5">
              <Skeleton className="h-4 w-48" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Traveler reviews unavailable
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{state.error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 gap-2"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : null}

      {state.status === "ready" && state.reviews.length === 0 && seedReviews.length === 0 ? (
        <p className="rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
          No traveler reviews yet — be the first to share what this airport is
          really like.
        </p>
      ) : null}

      {state.status === "ready" ? (
        <div className="space-y-4">
          {state.reviews.map((review) => (
            <ReviewCard
              key={review.id}
              author={review.author}
              meta={`${review.tripType} · ${dateFormatter.format(new Date(review.createdAt))}`}
              rating={review.rating}
              title={review.title}
              body={review.body}
            />
          ))}
        </div>
      ) : null}

      {seedReviews.length > 0 ? (
        <div className="space-y-4">
          {state.status === "ready" || state.status === "unavailable" ? (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              From our editors
            </p>
          ) : null}
          {seedReviews.map((review) => (
            <ReviewCard
              key={review.id}
              author={review.author}
              meta={`${review.tripType} · ${dateFormatter.format(new Date(review.createdAt))}`}
              rating={review.rating}
              title={review.title}
              body={review.body}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
