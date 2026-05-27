-- Users + projects + per-project API keys.

CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email");

CREATE TABLE IF NOT EXISTS "projects" (
  "id" text PRIMARY KEY NOT NULL,
  "owner_id" text NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "allowed_origins" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "projects_slug_unique" ON "projects" ("slug");
CREATE INDEX IF NOT EXISTS "projects_owner_idx" ON "projects" ("owner_id");

CREATE TABLE IF NOT EXISTS "project_api_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "key_hash" text NOT NULL,
  "prefix" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "project_api_keys_hash_unique" ON "project_api_keys" ("key_hash");
CREATE INDEX IF NOT EXISTS "project_api_keys_project_idx" ON "project_api_keys" ("project_id");
