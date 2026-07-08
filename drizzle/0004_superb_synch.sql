CREATE TABLE "airport_profiles" (
	"iata" varchar(3) PRIMARY KEY NOT NULL,
	"icao" varchar(4) NOT NULL,
	"short_name" text NOT NULL,
	"region" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"airportist_score" real NOT NULL,
	"score_breakdown" jsonb NOT NULL,
	"stats" jsonb NOT NULL,
	"summary" text NOT NULL,
	"best_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"watch_out_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transport" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"disruption" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "airport_reviews" ADD COLUMN "source" text DEFAULT 'community' NOT NULL;