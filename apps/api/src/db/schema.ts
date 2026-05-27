import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Postgres schema for the feedback platform.
 *
 * One table per top-level domain object. Comment thread is denormalized as
 * JSONB inside `feedback.thread` so a single SELECT returns the full thread
 * — the dashboard never wants a comment without its parent feedback, and
 * threads are typically short. If we ever need per-comment search, split
 * it into its own table.
 */

export const feedback = pgTable(
  "feedback",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    pageUrl: text("page_url").notNull(),
    selector: text("selector").notNull(),

    xPercent: doublePrecision("x_percent").notNull(),
    yPercent: doublePrecision("y_percent").notNull(),
    xPx: integer("x_px").notNull(),
    yPx: integer("y_px").notNull(),

    viewportWidth: integer("viewport_width").notNull(),
    viewportHeight: integer("viewport_height").notNull(),
    devicePixelRatio: doublePrecision("device_pixel_ratio").notNull(),

    screenshotKey: text("screenshot_key"),

    status: text("status", { enum: ["open", "resolved", "archived"] })
      .notNull()
      .default("open"),

    /** Thread comments — array of { id, author, body, createdAt }. */
    thread: jsonb("thread").$type<ThreadComment[]>().notNull().default(sql`'[]'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byProjectCreated: index("feedback_project_created_idx").on(t.projectId, t.createdAt),
    byProjectStatus: index("feedback_project_status_idx").on(t.projectId, t.status),
    byProjectPage: index("feedback_project_page_idx").on(t.projectId, t.pageUrl),
  })
);

export interface ThreadComment {
  id: string;
  author: { name: string; email?: string };
  body: string;
  createdAt: string;
}
