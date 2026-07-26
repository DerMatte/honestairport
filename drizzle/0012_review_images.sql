CREATE TABLE "airport_review_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"caption" text,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"taken_at" timestamp,
	"gps_latitude" double precision,
	"gps_longitude" double precision,
	"gps_distance_km" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "airport_review_images" ADD CONSTRAINT "airport_review_images_review_id_airport_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."airport_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "airport_review_images_review_id_sort_order_idx" ON "airport_review_images" USING btree ("review_id","sort_order");
