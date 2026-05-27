-- Generated migration: feedback table v1.
-- Run with `drizzle-kit migrate` once `DATABASE_URL` is configured, or apply
-- this SQL directly with psql.

CREATE TABLE IF NOT EXISTS "feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "page_url" text NOT NULL,
  "selector" text NOT NULL,
  "x_percent" double precision NOT NULL,
  "y_percent" double precision NOT NULL,
  "x_px" integer NOT NULL,
  "y_px" integer NOT NULL,
  "viewport_width" integer NOT NULL,
  "viewport_height" integer NOT NULL,
  "device_pixel_ratio" double precision NOT NULL,
  "screenshot_key" text,
  "status" text DEFAULT 'open' NOT NULL,
  "thread" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "feedback_project_created_idx"
  ON "feedback" ("project_id", "created_at");
CREATE INDEX IF NOT EXISTS "feedback_project_status_idx"
  ON "feedback" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "feedback_project_page_idx"
  ON "feedback" ("project_id", "page_url");
