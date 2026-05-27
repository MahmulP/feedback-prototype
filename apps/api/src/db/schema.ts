import { sql } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Postgres schema for the feedback platform.
 *
 * Tables:
 *   - users            ← dashboard accounts
 *   - projects         ← per-user projects, identified by slug
 *   - project_api_keys ← per-project ingest keys (hashed; SDK uses these)
 *   - feedback         ← pins, references project by slug for SDK ergonomics
 */

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** Argon2id (or scrypt) hash of the user's password. */
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUnique: uniqueIndex("users_email_unique").on(t.email),
  })
);

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    allowedOrigins: jsonb("allowed_origins").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    slugUnique: uniqueIndex("projects_slug_unique").on(t.slug),
    byOwner: index("projects_owner_idx").on(t.ownerId),
  })
);

export const projectApiKeys = pgTable(
  "project_api_keys",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    /** SHA-256 hex of the plaintext key. Plaintext is shown once at creation. */
    keyHash: text("key_hash").notNull(),
    /** First 8 chars of the plaintext key, kept for UI display only. */
    prefix: text("prefix").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => ({
    keyHashUnique: uniqueIndex("project_api_keys_hash_unique").on(t.keyHash),
    byProject: index("project_api_keys_project_idx").on(t.projectId),
  })
);

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
