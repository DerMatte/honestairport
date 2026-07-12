CREATE TABLE "airport_lounges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iata" varchar(3) NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"terminal" text NOT NULL,
	"zone" text,
	"location" text,
	"access" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hours" text,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"food_and_drinks" text,
	"showers" boolean,
	"best_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verdict" text,
	"summary" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"source_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_verified" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "airport_lounges_iata_slug_idx" ON "airport_lounges" USING btree ("iata","slug");--> statement-breakpoint
CREATE INDEX "airport_lounges_iata_idx" ON "airport_lounges" USING btree ("iata");