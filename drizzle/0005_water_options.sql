ALTER TABLE "airport_guides" ADD COLUMN IF NOT EXISTS "water_options" jsonb DEFAULT '[]'::jsonb NOT NULL;
