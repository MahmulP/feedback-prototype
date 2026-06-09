-- Public, read-only share links to a project's feedback.
-- The token is stored hashed (SHA-256); plaintext is shown once at creation.

CREATE TABLE IF NOT EXISTS "project_share_links" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "prefix" text NOT NULL,
  "label" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_used_at" timestamp with time zone,
  "expires_at" timestamp with time zone
);
CREATE UNIQUE INDEX IF NOT EXISTS "project_share_links_hash_unique" ON "project_share_links" ("token_hash");
CREATE INDEX IF NOT EXISTS "project_share_links_project_idx" ON "project_share_links" ("project_id");
