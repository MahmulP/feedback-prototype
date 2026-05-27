import { and, desc, eq, sql } from "drizzle-orm";
import type {
  CreateFeedbackInput,
  Feedback,
  FeedbackAuthor,
  FeedbackCoordinates,
  FeedbackStatus,
  ListFeedbackQuery,
} from "@mahmulp/shared-types";

import type { FeedbackStore, ProjectSummary } from "../store.js";
import type { DrizzleDb } from "./client.js";
import { feedback as feedbackTable, type ThreadComment } from "./schema.js";

/**
 * Drizzle-backed `FeedbackStore` implementation against PostgreSQL.
 *
 * Same interface as the in-memory store; routes can switch over without
 * changes when a `DATABASE_URL` is configured.
 */
export function createDbStore(db: DrizzleDb): FeedbackStore {
  function nowIso(): string {
    return new Date().toISOString();
  }

  function generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function rowToFeedback(row: typeof feedbackTable.$inferSelect): Feedback {
    return {
      id: row.id,
      projectId: row.projectId,
      pageUrl: row.pageUrl,
      selector: row.selector,
      coordinates: {
        xPercent: row.xPercent,
        yPercent: row.yPercent,
        xPx: row.xPx,
        yPx: row.yPx,
      },
      viewport: {
        width: row.viewportWidth,
        height: row.viewportHeight,
        devicePixelRatio: row.devicePixelRatio,
      },
      ...(row.screenshotKey ? { screenshotKey: row.screenshotKey } : {}),
      status: row.status,
      thread: row.thread,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  return {
    async list(query: ListFeedbackQuery): Promise<Feedback[]> {
      const filters = [eq(feedbackTable.projectId, query.projectId)];
      if (query.pageUrl) filters.push(eq(feedbackTable.pageUrl, query.pageUrl));
      if (query.status) filters.push(eq(feedbackTable.status, query.status));
      const rows = await db
        .select()
        .from(feedbackTable)
        .where(and(...filters))
        .orderBy(desc(feedbackTable.createdAt))
        .limit(200);
      return rows.map(rowToFeedback);
    },

    async get(id: string): Promise<Feedback | null> {
      const [row] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, id)).limit(1);
      return row ? rowToFeedback(row) : null;
    },

    async create(input: CreateFeedbackInput): Promise<Feedback> {
      const id = generateId("fb");
      const initialThread: ThreadComment[] = input.comment
        ? [
            {
              id: `cm_${id}_0`,
              author: { ...input.comment.author },
              body: input.comment.body,
              createdAt: nowIso(),
            },
          ]
        : [];
      const [row] = await db
        .insert(feedbackTable)
        .values({
          id,
          projectId: input.projectId,
          pageUrl: input.pageUrl,
          selector: input.selector,
          xPercent: input.coordinates.xPercent,
          yPercent: input.coordinates.yPercent,
          xPx: input.coordinates.xPx,
          yPx: input.coordinates.yPx,
          viewportWidth: input.viewport.width,
          viewportHeight: input.viewport.height,
          devicePixelRatio: input.viewport.devicePixelRatio,
          status: "open",
          thread: initialThread,
        })
        .returning();
      if (!row) throw new Error("create: insert returned no row");
      return rowToFeedback(row);
    },

    async reply(
      id: string,
      comment: { author: FeedbackAuthor; body: string }
    ): Promise<Feedback | null> {
      const [existing] = await db
        .select()
        .from(feedbackTable)
        .where(eq(feedbackTable.id, id))
        .limit(1);
      if (!existing) return null;
      const next = [
        ...existing.thread,
        {
          id: `cm_${id}_${existing.thread.length}`,
          author: { ...comment.author },
          body: comment.body,
          createdAt: nowIso(),
        },
      ] satisfies ThreadComment[];
      const [row] = await db
        .update(feedbackTable)
        .set({ thread: next, updatedAt: new Date() })
        .where(eq(feedbackTable.id, id))
        .returning();
      return row ? rowToFeedback(row) : null;
    },

    async setStatus(id: string, status: FeedbackStatus): Promise<Feedback | null> {
      const [row] = await db
        .update(feedbackTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(feedbackTable.id, id))
        .returning();
      return row ? rowToFeedback(row) : null;
    },

    async attachScreenshot(id: string, key: string): Promise<Feedback | null> {
      const [row] = await db
        .update(feedbackTable)
        .set({ screenshotKey: key, updatedAt: new Date() })
        .where(eq(feedbackTable.id, id))
        .returning();
      return row ? rowToFeedback(row) : null;
    },

    async setCoordinates(id: string, coordinates: FeedbackCoordinates): Promise<Feedback | null> {
      const [row] = await db
        .update(feedbackTable)
        .set({
          xPercent: coordinates.xPercent,
          yPercent: coordinates.yPercent,
          xPx: coordinates.xPx,
          yPx: coordinates.yPx,
          updatedAt: new Date(),
        })
        .where(eq(feedbackTable.id, id))
        .returning();
      return row ? rowToFeedback(row) : null;
    },

    async listProjects(): Promise<ProjectSummary[]> {
      const rows = await db
        .select({
          projectId: feedbackTable.projectId,
          totalFeedback: sql<number>`count(*)`,
          openFeedback: sql<number>`count(*) FILTER (WHERE ${feedbackTable.status} = 'open')`,
        })
        .from(feedbackTable)
        .groupBy(feedbackTable.projectId)
        .orderBy(feedbackTable.projectId);

      return rows.map((r) => ({
        projectId: r.projectId,
        totalFeedback: Number(r.totalFeedback),
        openFeedback: Number(r.openFeedback),
      }));
    },
  };
}
