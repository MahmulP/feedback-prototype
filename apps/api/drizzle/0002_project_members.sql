-- Project sharing: collaborators a project has been shared with.
-- Stored rows are "editor" or "viewer"; the owner is implicit on the project.

CREATE TABLE IF NOT EXISTS "project_members" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "user_id" text NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "role" text DEFAULT 'viewer' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "project_members_unique" ON "project_members" ("project_id", "user_id");
CREATE INDEX IF NOT EXISTS "project_members_project_idx" ON "project_members" ("project_id");
CREATE INDEX IF NOT EXISTS "project_members_user_idx" ON "project_members" ("user_id");
