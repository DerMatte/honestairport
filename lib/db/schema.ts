import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AirportBentoTip, AirportLounge, AirportWaterOption } from "@/lib/airport-guides";
import type {
  Amenity,
  Disruption,
  Region,
  AirportScoreBreakdown,
  AirportStats,
  Tip,
  TransportOption,
} from "@/lib/types";

export const airportReviews = pgTable(
  "airport_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    iata: varchar("iata", { length: 3 }).notNull(),
    author: text("author").notNull(),
    tripType: text("trip_type").notNull(),
    rating: smallint("rating").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // Moderation kill switch: flip to "hidden" in SQL to pull a review.
    status: text("status", { enum: ["published", "hidden"] })
      .notNull()
      .default("published"),
    // "editorial" = curated by us (seeded from the old scored-airport dataset),
    // "community" = submitted through the public review form.
    source: text("source", { enum: ["editorial", "community"] })
      .notNull()
      .default("community"),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("airport_reviews_iata_created_at_idx").on(table.iata, table.createdAt.desc()),
    index("airport_reviews_ip_hash_created_at_idx").on(table.ipHash, table.createdAt.desc()),
    check("airport_reviews_rating_check", sql`${table.rating} BETWEEN 1 AND 5`),
  ],
);

export type AirportReviewRow = typeof airportReviews.$inferSelect;
export type NewAirportReviewRow = typeof airportReviews.$inferInsert;

export const airportGuides = pgTable("airport_guides", {
  iata: varchar("iata", { length: 3 }).primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  country: text("country").notNull(),
  // ISO date string, mirrors the `lastUpdated` frontmatter field.
  lastUpdated: text("last_updated").notNull(),
  sources: jsonb("sources").$type<string[]>().notNull().default([]),
  quickFacts: jsonb("quick_facts").$type<string[]>().notNull().default([]),
  bentoTips: jsonb("bento_tips").$type<AirportBentoTip[]>().notNull().default([]),
  lounges: jsonb("lounges").$type<AirportLounge[]>().notNull().default([]),
  waterOptions: jsonb("water_options").$type<AirportWaterOption[]>().notNull().default([]),
  // Markdown body (everything below the frontmatter).
  content: text("content").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Snapshot of the previous row taken on every guide upsert. Replaces the
 * rollback/audit trail Git provided when guides lived in the repo.
 */
export const airportGuideRevisions = pgTable(
  "airport_guide_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    iata: varchar("iata", { length: 3 }).notNull(),
    snapshot: jsonb("snapshot").$type<AirportGuideRow>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("airport_guide_revisions_iata_created_at_idx").on(
      table.iata,
      table.createdAt.desc(),
    ),
  ],
);

export type AirportGuideRow = typeof airportGuides.$inferSelect;
export type NewAirportGuideRow = typeof airportGuides.$inferInsert;

/**
 * Rights-cleared photos per airport, sourced from Wikimedia Commons by the
 * image sync pipeline and served from Vercel Blob. `sourceUrl` points at the
 * Commons file page; `credit`/`license` must be rendered wherever the image
 * is shown (CC attribution requirement).
 */
export const airportImages = pgTable(
  "airport_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    iata: varchar("iata", { length: 3 }).notNull(),
    // Public Vercel Blob URL of the resized webp we serve.
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    caption: text("caption"),
    credit: text("credit").notNull(),
    license: text("license").notNull(),
    licenseUrl: text("license_url"),
    sourceUrl: text("source_url").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("airport_images_iata_sort_order_idx").on(table.iata, table.sortOrder),
    uniqueIndex("airport_images_iata_source_url_idx").on(table.iata, table.sourceUrl),
  ],
);

export type AirportImageRow = typeof airportImages.$inferSelect;
export type NewAirportImageRow = typeof airportImages.$inferInsert;

/**
 * Google Maps aggregate rating per airport, fetched by the ratings sync
 * script (ScrapingBee Google API). One row per airport, replaced on each
 * sync; `raw` keeps the matched search result for debugging and future
 * signal extraction.
 */
export const airportGoogleRatings = pgTable("airport_google_ratings", {
  iata: varchar("iata", { length: 3 }).primaryKey(),
  // Place name Google matched, e.g. "Heathrow Airport" — kept to audit
  // that the search resolved to the airport and not a nearby business.
  placeName: text("place_name").notNull(),
  rating: real("rating").notNull(),
  reviewCount: integer("review_count").notNull(),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AirportGoogleRatingRow = typeof airportGoogleRatings.$inferSelect;
export type NewAirportGoogleRatingRow = typeof airportGoogleRatings.$inferInsert;

/** jsonb can't hold a `Date`, so `lastUpdated` is stored as an ISO string here. */
export type AirportProfileDisruption = Omit<Disruption, "lastUpdated"> & {
  lastUpdated: string;
};

/**
 * Editorial scoring/curation data for our most deeply audited airports —
 * Airportist Score, amenities, tips, transport options, disruption badge.
 * Deliberately separate from `airport_guides` (which the AI content pipeline
 * overwrites wholesale) so that pipeline never needs to know about, or risk
 * clobbering, hand-curated scoring data. Joined to `airport_guides` by
 * `iata` (soft key, no FK, matching the other per-concern tables here) for
 * name/city/country, which stay authoritative there.
 */
export const airportProfiles = pgTable("airport_profiles", {
  iata: varchar("iata", { length: 3 }).primaryKey(),
  icao: varchar("icao", { length: 4 }).notNull(),
  shortName: text("short_name").notNull(),
  region: text("region", {
    enum: ["North America", "Europe", "Asia-Pacific", "Middle East", "South America", "Africa"],
  })
    .notNull()
    .$type<Region>(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  airportistScore: real("airportist_score").notNull(),
  scoreBreakdown: jsonb("score_breakdown").$type<AirportScoreBreakdown>().notNull(),
  stats: jsonb("stats").$type<AirportStats>().notNull(),
  summary: text("summary").notNull(),
  bestFor: jsonb("best_for").$type<string[]>().notNull().default([]),
  watchOutFor: jsonb("watch_out_for").$type<string[]>().notNull().default([]),
  amenities: jsonb("amenities").$type<Amenity[]>().notNull().default([]),
  tips: jsonb("tips").$type<Tip[]>().notNull().default([]),
  transport: jsonb("transport").$type<TransportOption[]>().notNull().default([]),
  disruption: jsonb("disruption").$type<AirportProfileDisruption>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AirportProfileRow = typeof airportProfiles.$inferSelect;
export type NewAirportProfileRow = typeof airportProfiles.$inferInsert;
