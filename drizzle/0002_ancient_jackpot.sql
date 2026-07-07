CREATE TABLE "airport_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iata" varchar(3) NOT NULL,
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
CREATE INDEX "airport_images_iata_sort_order_idx" ON "airport_images" USING btree ("iata","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "airport_images_iata_source_url_idx" ON "airport_images" USING btree ("iata","source_url");