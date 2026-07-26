import { z } from "zod";

export const TRIP_TYPES = [
  "Business",
  "Leisure",
  "Family trip",
  "Solo travel",
  "International connection",
  "Domestic connection",
] as const;

export type TripType = (typeof TRIP_TYPES)[number];

export const reviewFormSchema = z.object({
  author: z
    .string()
    .trim()
    .min(2, "Add a name (or initials) other travelers will see.")
    .max(60, "Keep the name under 60 characters."),
  tripType: z.enum(TRIP_TYPES, { error: "Pick the kind of trip this was." }),
  rating: z
    .number({ error: "Pick a star rating." })
    .int()
    .min(1, "Pick a star rating.")
    .max(5),
  title: z
    .string()
    .trim()
    .min(4, "Give the review a short title.")
    .max(80, "Keep the title under 80 characters."),
  body: z
    .string()
    .trim()
    .min(20, "Tell other travelers a bit more — at least 20 characters.")
    .max(2000, "Keep the review under 2,000 characters."),
  // Honeypot: humans never see this field, so anything in it means a bot.
  // Deliberately unvalidated — the API quietly drops submissions that fill it.
  website: z.string().optional(),
});

export type ReviewFormValues = z.infer<typeof reviewFormSchema>;

/** Max photos a single review can carry. Enforced on both sides of the form. */
export const MAX_REVIEW_IMAGES = 4;

/** Photo captions double as alt text, so keep them short enough to be read out. */
export const MAX_REVIEW_CAPTION_LENGTH = 140;

/** A photo attached to a review, as served by /api/airports/[iata]/reviews. */
export interface ReviewImage {
  id: string;
  url: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
}

/** A published review as served by /api/airports/[iata]/reviews. */
export interface AirportUserReview {
  id: string;
  author: string;
  tripType: string;
  rating: number;
  title: string;
  body: string;
  createdAt: string;
  images: ReviewImage[];
  /** Computed for the current session; user ids are never exposed to the client. */
  canEdit?: boolean;
}
