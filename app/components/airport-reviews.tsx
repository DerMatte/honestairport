"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  CheckCircle2,
  ImagePlus,
  Pencil,
  RefreshCw,
  Star,
  X,
} from "lucide-react";
import { isAdmin } from "@/lib/admin";
import { useSession } from "@/lib/auth-client";
import { ReviewPhotoThumbs } from "@/app/components/review-photo-thumbs";
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
  MAX_REVIEW_CAPTION_LENGTH,
  MAX_REVIEW_IMAGES,
  TRIP_TYPES,
  reviewFormSchema,
  type AirportUserReview,
  type ReviewFormValues,
  type ReviewImage,
} from "@/lib/review-schema";

/** Mirrors the server's per-file ceiling in lib/review-images.ts. */
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

const ACCEPTED_PHOTO_TYPES = "image/jpeg,image/png,image/webp";
const ACCEPTED_PHOTO_TYPE_SET = new Set(ACCEPTED_PHOTO_TYPES.split(","));

/**
 * Vercel Functions reject request bodies above 4.5 MB. Keep the entire photo
 * batch comfortably below that ceiling after multipart overhead and text.
 */
const SAFE_MULTIPART_PHOTO_BYTES = Math.floor(3.5 * 1024 * 1024);
const MAX_UPLOAD_PHOTO_DIMENSION = 1600;

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("This browser couldn't prepare that photo."));
        }
      },
      "image/webp",
      quality,
    );
  });
}

async function loadPhoto(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Shrink only when needed. Small files keep their original EXIF; larger camera
 * files are converted to WebP so a batch of four fits through the Function
 * request limit. The server still decodes and re-encodes every result.
 */
async function preparePhotoForUpload(file: File, maxBytes: number): Promise<File> {
  if (file.size <= maxBytes) {
    return file;
  }

  const image = await loadPhoto(file);
  const initialScale = Math.min(
    1,
    MAX_UPLOAD_PHOTO_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
  );
  let width = Math.max(1, Math.round(image.naturalWidth * initialScale));
  let height = Math.max(1, Math.round(image.naturalHeight * initialScale));

  for (let sizeAttempt = 0; sizeAttempt < 5; sizeAttempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("This browser couldn't prepare that photo.");
    }

    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.82, 0.68, 0.54]) {
      const blob = await canvasToBlob(canvas, quality);

      if (blob.size <= maxBytes) {
        const basename = file.name.replace(/\.[^.]+$/, "") || "review-photo";
        return new File([blob], `${basename}.webp`, {
          type: "image/webp",
          lastModified: file.lastModified,
        });
      }
    }

    width = Math.max(1, Math.round(width * 0.78));
    height = Math.max(1, Math.round(height * 0.78));
  }

  throw new Error(
    `"${file.name}" is too detailed to upload with this batch. Try a smaller photo.`,
  );
}

interface AirportReviewsProps {
  iata: string;
  /** Editorial seed reviews shown after community ones. */
  seedReviews?: AirportUserReview[];
  /** Server-resolved community reviews; skips the first client fetch. */
  initialReviews?: AirportUserReview[];
  /** Server already determined the reviews API is unavailable. */
  initialUnavailable?: boolean;
  showHeading?: boolean;
  className?: string;
}

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
  images,
  canEdit = false,
  onEdit,
}: {
  author: string;
  meta: string;
  rating: number;
  title: string;
  body: string;
  // Optional: cached editorial reviews from before photos shipped have no field.
  images?: ReviewImage[];
  canEdit?: boolean;
  onEdit?: () => void;
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
          <div className="flex items-center gap-2">
            <StarRow rating={rating} />
            {canEdit && onEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={onEdit}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit
              </Button>
            ) : null}
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{body}</p>
        {images?.length ? <ReviewPhotoThumbs images={images} /> : null}
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
          className="rounded-md p-0.5 transition-transform duration-[var(--duration-press)] ease-[var(--ease-out)] active:scale-[0.97] pointer-fine:hover:scale-110 motion-reduce:transition-none motion-reduce:active:scale-100 motion-reduce:pointer-fine:hover:scale-100 focus-visible:outline-2 focus-visible:outline-ring"
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
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Object URLs outlive the component unless we hand them back. Removals revoke
  // as they happen; this covers whatever is still pending at unmount, read
  // through a ref so the cleanup never closes over a stale list.
  const photosRef = useRef(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(
    () => () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    },
    [],
  );

  function addPhotos(selected: FileList) {
    const currentPhotos = photosRef.current;
    const room = MAX_REVIEW_IMAGES - currentPhotos.length;
    const accepted: PendingPhoto[] = [];
    let error: string | null = null;

    for (const file of Array.from(selected)) {
      if (accepted.length >= room) {
        error = `You can attach up to ${MAX_REVIEW_IMAGES} photos.`;
        break;
      }

      if (file.size > MAX_PHOTO_BYTES) {
        error = `"${file.name}" is too large (max ${Math.round(
          MAX_PHOTO_BYTES / (1024 * 1024),
        )} MB).`;
        continue;
      }

      if (!ACCEPTED_PHOTO_TYPE_SET.has(file.type)) {
        error = `"${file.name}" isn't a supported image (JPEG, PNG or WebP).`;
        continue;
      }

      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        caption: "",
      });
    }

    // Keep the ref in sync immediately so rapid consecutive picker changes
    // accumulate instead of both reading the same render's photo count.
    const nextPhotos = [...currentPhotos, ...accepted];
    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
    setPhotoError(error);
  }

  function removePhoto(id: string) {
    const currentPhotos = photosRef.current;
    const photo = currentPhotos.find((candidate) => candidate.id === id);

    if (photo) {
      URL.revokeObjectURL(photo.previewUrl);
    }

    const nextPhotos = currentPhotos.filter((candidate) => candidate.id !== id);
    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
    setPhotoError(null);
  }

  function clearPhotos() {
    setPhotos((current) => {
      for (const photo of current) {
        URL.revokeObjectURL(photo.previewUrl);
      }

      return [];
    });
    setPhotoError(null);
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitState({ status: "idle" });

    try {
      // Multipart so the photos and the review land in one atomic request.
      const formData = new FormData();
      formData.set("author", values.author);
      formData.set("tripType", values.tripType);
      formData.set("rating", String(values.rating));
      formData.set("title", values.title);
      formData.set("body", values.body);
      formData.set("website", values.website ?? "");

      const perPhotoBudget =
        photos.length > 0
          ? Math.floor(SAFE_MULTIPART_PHOTO_BYTES / photos.length)
          : SAFE_MULTIPART_PHOTO_BYTES;

      // Prepare sequentially to avoid holding several decoded phone photos in
      // memory at once. This is what makes four-photo submissions fit through
      // the hosting request limit.
      for (const photo of photos) {
        const uploadFile = await preparePhotoForUpload(photo.file, perPhotoBudget);
        formData.append("photos", uploadFile);
        formData.append("photoCaptions", photo.caption.trim());
      }

      const response = await fetch(`/api/airports/${encodeURIComponent(iata)}/reviews`, {
        method: "POST",
        // No Content-Type: the browser has to add the multipart boundary.
        headers: { "x-honestairport-form": "1" },
        body: formData,
      });

      if (!response.ok) {
        // A 413 comes from the platform as HTML, so there's no JSON error to read.
        const payload =
          response.status === 413
            ? null
            : ((await response.json().catch(() => null)) as { error?: string } | null);
        throw new Error(
          payload?.error ??
            (response.status === 413
              ? "Those photos are too large — try fewer or smaller photos."
              : response.status === 429
                ? "Too many reviews submitted — try again later."
                : "Something went wrong submitting your review."),
        );
      }

      const payload = (await response.json()) as { review: AirportUserReview | null };

      if (payload.review) {
        onCreated(payload.review);
      }

      reset();
      clearPhotos();
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

          <div className="space-y-2">
            <Label htmlFor={`review-photos-${iata}`}>Photos (optional)</Label>
            <input
              ref={fileInputRef}
              id={`review-photos-${iata}`}
              type="file"
              multiple
              // Not image/* — iOS then hands us HEIC, which the server can't decode.
              accept={ACCEPTED_PHOTO_TYPES}
              className="sr-only"
              onChange={(event) => {
                if (event.target.files?.length) {
                  addPhotos(event.target.files);
                }
                // Reset so picking the same file again still fires onChange.
                event.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={photos.length >= MAX_REVIEW_IMAGES}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="size-4" aria-hidden="true" />
                Add photos
              </Button>
              <p className="text-xs text-muted-foreground">
                {photos.length}/{MAX_REVIEW_IMAGES} selected · JPEG, PNG or WebP
              </p>
            </div>
            {photoError ? <p className="text-xs text-destructive">{photoError}</p> : null}
            {photos.length > 0 ? (
              <ul className="space-y-2">
                {photos.map((photo) => (
                  <li key={photo.id} className="flex items-center gap-3">
                    {/* Local object URL, so next/image would only add indirection. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt=""
                      className="size-14 shrink-0 rounded-lg object-cover ring-1 ring-black/5"
                    />
                    <Input
                      value={photo.caption}
                      maxLength={MAX_REVIEW_CAPTION_LENGTH}
                      placeholder="Caption (optional)"
                      aria-label={`Caption for ${photo.file.name}`}
                      onChange={(event) =>
                        setPhotos((current) =>
                          current.map((candidate) =>
                            candidate.id === photo.id
                              ? { ...candidate, caption: event.target.value }
                              : candidate,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      aria-label={`Remove ${photo.file.name}`}
                      onClick={() => removePhoto(photo.id)}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
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
              {isSubmitting
                ? photos.length > 0
                  ? `Preparing ${photos.length} photo${photos.length === 1 ? "" : "s"}…`
                  : "Submitting…"
                : "Post review"}
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

function EditReviewForm({
  iata,
  review,
  onUpdated,
  onCancel,
}: {
  iata: string;
  review: AirportUserReview;
  onUpdated: (review: AirportUserReview) => void;
  onCancel: () => void;
}) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      author: review.author,
      tripType: review.tripType as ReviewFormValues["tripType"],
      rating: review.rating,
      title: review.title,
      body: review.body,
      website: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);

    try {
      const response = await fetch(
        `/api/airports/${encodeURIComponent(iata)}/reviews/${encodeURIComponent(review.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { review?: AirportUserReview; error?: string }
        | null;

      if (!response.ok || !payload?.review) {
        throw new Error(payload?.error ?? "Something went wrong saving your review.");
      }

      onUpdated(payload.review);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Something went wrong saving your review.",
      );
    }
  });

  const fieldPrefix = `edit-review-${review.id}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edit your review</CardTitle>
        {review.images.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Your {review.images.length} attached{" "}
            {review.images.length === 1 ? "photo stays" : "photos stay"} with the review.
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${fieldPrefix}-author`}>Name</Label>
              <Input
                id={`${fieldPrefix}-author`}
                aria-invalid={Boolean(errors.author)}
                {...register("author")}
              />
              {errors.author ? (
                <p className="text-xs text-destructive">{errors.author.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${fieldPrefix}-trip-type`}>Trip type</Label>
              <Controller
                control={control}
                name="tripType"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger
                      id={`${fieldPrefix}-trip-type`}
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
            <Label htmlFor={`${fieldPrefix}-title`}>Title</Label>
            <Input
              id={`${fieldPrefix}-title`}
              aria-invalid={Boolean(errors.title)}
              {...register("title")}
            />
            {errors.title ? (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`${fieldPrefix}-body`}>Review</Label>
            <Textarea
              id={`${fieldPrefix}-body`}
              aria-invalid={Boolean(errors.body)}
              {...register("body")}
            />
            {errors.body ? (
              <p className="text-xs text-destructive">{errors.body.message}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Cancel
            </Button>
            {submitError ? (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="size-4" aria-hidden="true" />
                {submitError}
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
  initialReviews,
  initialUnavailable = false,
  showHeading = false,
  className,
}: AirportReviewsProps) {
  const hasServerSnapshot = initialUnavailable || initialReviews !== undefined;
  const [state, setState] = useState<ReviewsState>(() =>
    initialReviewsState(initialReviews, initialUnavailable),
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldClientFetchReviews(reloadKey, hasServerSnapshot)) {
      return;
    }

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
  }, [hasServerSnapshot, iata, reloadKey]);

  const handleCreated = useCallback((review: AirportUserReview) => {
    setState((current) =>
      current.status === "ready"
        ? { status: "ready", reviews: [review, ...current.reviews] }
        : { status: "ready", reviews: [review] },
    );
  }, []);

  const handleUpdated = useCallback((updatedReview: AirportUserReview) => {
    setState((current) =>
      current.status === "ready"
        ? {
            status: "ready",
            reviews: current.reviews.map((review) =>
              review.id === updatedReview.id ? updatedReview : review,
            ),
          }
        : current,
    );
    setEditingReviewId(null);
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
          {state.reviews.map((review) =>
            editingReviewId === review.id ? (
              <EditReviewForm
                key={review.id}
                iata={iata}
                review={review}
                onUpdated={handleUpdated}
                onCancel={() => setEditingReviewId(null)}
              />
            ) : (
              <ReviewCard
                key={review.id}
                author={review.author}
                meta={`${review.tripType} · ${dateFormatter.format(new Date(review.createdAt))}`}
                rating={review.rating}
                title={review.title}
                body={review.body}
                images={review.images}
                canEdit={review.canEdit}
                onEdit={() => setEditingReviewId(review.id)}
              />
            ),
          )}
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
              images={review.images}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
