CREATE TABLE "airport_guide_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iata" varchar(3) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "airport_guides" (
	"iata" varchar(3) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"last_updated" text NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"quick_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bento_tips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lounges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "airport_guide_revisions_iata_created_at_idx" ON "airport_guide_revisions" USING btree ("iata","created_at" DESC NULLS LAST);