ALTER TABLE "airport_guides" ADD COLUMN "requested_by_user_id" text;--> statement-breakpoint
ALTER TABLE "airport_guides" ADD CONSTRAINT "airport_guides_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
