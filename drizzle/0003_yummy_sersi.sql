CREATE TABLE "airport_google_ratings" (
	"iata" varchar(3) PRIMARY KEY NOT NULL,
	"place_name" text NOT NULL,
	"rating" real NOT NULL,
	"review_count" integer NOT NULL,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
