-- Denormalize the original reporter onto each feedback row so the dashboard
-- can show "reported by" without walking the thread. Nullable; existing rows
-- and comment-less pins stay null (UI falls back to thread[0].author).

ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "author" jsonb;
