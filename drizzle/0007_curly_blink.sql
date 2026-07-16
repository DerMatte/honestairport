CREATE TABLE "airport_lounge_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iata" varchar(3) NOT NULL,
	"lounge_slug" text NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"caption" text,
	"credit" text NOT NULL,
	"license" text NOT NULL,
	"license_url" text,
	"source_url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "airport_lounge_images_iata_slug_sort_idx" ON "airport_lounge_images" USING btree ("iata","lounge_slug","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "airport_lounge_images_iata_slug_source_url_idx" ON "airport_lounge_images" USING btree ("iata","lounge_slug","source_url");