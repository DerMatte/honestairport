ALTER TABLE "user" ADD COLUMN "mcp_token_hash" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "mcp_token_prefix" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "mcp_token_created_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "user_mcp_token_hash_uidx" ON "user" USING btree ("mcp_token_hash");
