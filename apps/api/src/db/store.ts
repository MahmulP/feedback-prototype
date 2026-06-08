import { and, count, desc, eq, ne, sql } from "drizzle-orm";
import type {
  Feedback,
  FeedbackCoordinates,
  FeedbackStatus,
  Project,
  ProjectApiKeyMetadata,
  ProjectMember,
  ProjectRole,
  ProjectSummary,
  SharedRole,
  User,
} from "@mahmulp/shared-types";

import type { FeedbackStore } from "../store.js";
import type { DrizzleDb } from "./client.js";
import {
  feedback as feedbackTable,
  projectApiKeys as keyTable,
  projectMembers as memberTable,
  projects as projectsTable,
  type ThreadComment,
  users as usersTable,
} from "./schema.js";

/**
 * Drizzle-backed FeedbackStore. Wired up when `DATABASE_URL` is configured.
 */
export function createDbStore(db: DrizzleDb): FeedbackStore {
  const generateId = (prefix: string) =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = () => new Date().toISOString();

  function rowToProject(row: typeof projectsTable.$inferSelect): Project {
    return {
      id: row.id,
      ownerId: row.ownerId,
      slug: row.slug,
      name: row.name,
      ...(row.description ? { description: row.description } : {}),
      allowedOrigins: row.allowedOrigins ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  function rowToUser(row: typeof usersTable.$inferSelect): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
    };
  }

  function rowToKey(row: typeof keyTable.$inferSelect): ProjectApiKeyMetadata {
    return {
      id: row.id,
      projectId: row.projectId,
      prefix: row.prefix,
      createdAt: row.createdAt.toISOString(),
      ...(row.lastUsedAt ? { lastUsedAt: row.lastUsedAt.toISOString() } : {}),
    };
  }

  function rowToMember(row: typeof memberTable.$inferSelect): ProjectMember {
    return {
      id: row.id,
      projectId: row.projectId,
      userId: row.userId,
      email: row.email,
      name: row.name,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
    };
  }

  function rowToFeedback(row: typeof feedbackTable.$inferSelect): Feedback {    return {
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
    // ---------------- users ----------------
    async createUser(input) {
      try {
        const [row] = await db
          .insert(usersTable)
          .values({
            id: generateId("usr"),
            email: input.email.toLowerCase(),
            name: input.name,
            passwordHash: input.passwordHash,
          })
          .returning();
        if (!row) throw new Error("createUser: insert returned no row");
        return rowToUser(row);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "23505") throw new Error("user_exists");
        throw err;
      }
    },

    async getUserByEmail(email) {
      const [row] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, email.toLowerCase()))
        .limit(1);
      if (!row) return null;
      return { user: rowToUser(row), passwordHash: row.passwordHash };
    },

    async getUserById(id) {
      const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
      return row ? rowToUser(row) : null;
    },

    // ---------------- projects ----------------
    async createProject(ownerId, input) {
      try {
        const [row] = await db
          .insert(projectsTable)
          .values({
            id: generateId("prj"),
            ownerId,
            slug: input.slug.toLowerCase(),
            name: input.name,
            ...(input.description ? { description: input.description } : {}),
            allowedOrigins: input.allowedOrigins ?? [],
          })
          .returning();
        if (!row) throw new Error("createProject: insert returned no row");
        return rowToProject(row);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "23505") throw new Error("project_exists");
        throw err;
      }
    },

    async getProject(slug) {
      const [row] = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.slug, slug.toLowerCase()))
        .limit(1);
      return row ? rowToProject(row) : null;
    },

    async listProjectsForUser(userId) {
      const countCols = {
        totalFeedback: sql<number>`(select count(*) from ${feedbackTable} where ${feedbackTable.projectId} = ${projectsTable.slug})`,
        openFeedback: sql<number>`(select count(*) from ${feedbackTable} where ${feedbackTable.projectId} = ${projectsTable.slug} and ${feedbackTable.status} = 'open')`,
      };

      const owned = await db
        .select({ project: projectsTable, ...countCols })
        .from(projectsTable)
        .where(eq(projectsTable.ownerId, userId))
        .orderBy(desc(projectsTable.createdAt));

      const shared = await db
        .select({ project: projectsTable, role: memberTable.role, ...countCols })
        .from(memberTable)
        .innerJoin(projectsTable, eq(projectsTable.id, memberTable.projectId))
        .where(and(eq(memberTable.userId, userId), ne(projectsTable.ownerId, userId)))
        .orderBy(desc(projectsTable.createdAt));

      const summaries: ProjectSummary[] = [
        ...owned.map((r): ProjectSummary => ({
          ...rowToProject(r.project),
          totalFeedback: Number(r.totalFeedback),
          openFeedback: Number(r.openFeedback),
          role: "owner",
        })),
        ...shared.map((r): ProjectSummary => ({
          ...rowToProject(r.project),
          totalFeedback: Number(r.totalFeedback),
          openFeedback: Number(r.openFeedback),
          role: r.role,
        })),
      ];
      return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async getProjectForUser(slug, userId) {
      const [row] = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.slug, slug.toLowerCase()))
        .limit(1);
      if (!row) return null;
      const project = rowToProject(row);
      if (project.ownerId === userId) return { project, role: "owner" };
      const [member] = await db
        .select()
        .from(memberTable)
        .where(and(eq(memberTable.projectId, project.id), eq(memberTable.userId, userId)))
        .limit(1);
      if (!member) return null;
      return { project, role: member.role };
    },

    async updateProject(slug, ownerId, input) {
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) set.name = input.name;
      if (input.description !== undefined) set.description = input.description;
      if (input.allowedOrigins !== undefined) set.allowedOrigins = input.allowedOrigins;
      const [row] = await db
        .update(projectsTable)
        .set(set)
        .where(and(eq(projectsTable.slug, slug.toLowerCase()), eq(projectsTable.ownerId, ownerId)))
        .returning();
      return row ? rowToProject(row) : null;
    },

    async deleteProject(slug, ownerId) {
      const [row] = await db
        .delete(projectsTable)
        .where(and(eq(projectsTable.slug, slug.toLowerCase()), eq(projectsTable.ownerId, ownerId)))
        .returning();
      if (!row) return false;
      // Cascade: drop keys, members, and feedback referencing this project.
      await db.delete(keyTable).where(eq(keyTable.projectId, row.id));
      await db.delete(memberTable).where(eq(memberTable.projectId, row.id));
      await db.delete(feedbackTable).where(eq(feedbackTable.projectId, row.slug));
      return true;
    },

    // ---------------- project api keys ----------------
    async createProjectApiKey(projectId, input) {
      const [row] = await db
        .insert(keyTable)
        .values({
          id: generateId("pk"),
          projectId,
          keyHash: input.keyHash,
          prefix: input.prefix,
        })
        .returning();
      if (!row) throw new Error("createProjectApiKey: insert returned no row");
      return rowToKey(row);
    },

    async listProjectApiKeys(projectId) {
      const rows = await db
        .select()
        .from(keyTable)
        .where(eq(keyTable.projectId, projectId))
        .orderBy(keyTable.createdAt);
      return rows.map(rowToKey);
    },

    async deleteProjectApiKey(id, projectId) {
      const [row] = await db
        .delete(keyTable)
        .where(and(eq(keyTable.id, id), eq(keyTable.projectId, projectId)))
        .returning();
      return Boolean(row);
    },

    async resolveProjectByKeyHash(keyHash) {
      const [row] = await db
        .select({ key: keyTable, project: projectsTable })
        .from(keyTable)
        .innerJoin(projectsTable, eq(projectsTable.id, keyTable.projectId))
        .where(eq(keyTable.keyHash, keyHash))
        .limit(1);
      if (!row) return null;
      // Touch last_used_at, fire-and-forget.
      void db
        .update(keyTable)
        .set({ lastUsedAt: new Date() })
        .where(eq(keyTable.id, row.key.id))
        .catch(() => {});
      return rowToProject(row.project);
    },

    // ---------------- project members (sharing) ----------------
    async addProjectMember(projectId, user, role) {
      try {
        const [row] = await db
          .insert(memberTable)
          .values({
            id: generateId("pm"),
            projectId,
            userId: user.id,
            email: user.email,
            name: user.name,
            role,
          })
          .returning();
        if (!row) throw new Error("addProjectMember: insert returned no row");
        return rowToMember(row);
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === "23505") throw new Error("already_member");
        throw err;
      }
    },

    async listProjectMembers(projectId) {
      const rows = await db
        .select()
        .from(memberTable)
        .where(eq(memberTable.projectId, projectId))
        .orderBy(memberTable.createdAt);
      return rows.map(rowToMember);
    },

    async removeProjectMember(memberId, projectId) {
      const [row] = await db
        .delete(memberTable)
        .where(and(eq(memberTable.id, memberId), eq(memberTable.projectId, projectId)))
        .returning();
      return Boolean(row);
    },

    async getMembership(projectId, userId) {
      const [row] = await db
        .select()
        .from(memberTable)
        .where(and(eq(memberTable.projectId, projectId), eq(memberTable.userId, userId)))
        .limit(1);
      return row ? rowToMember(row) : null;
    },

    // ---------------- feedback ----------------
    async list(query) {
      const filters = [eq(feedbackTable.projectId, query.projectId)];
      if (query.pageUrl) filters.push(eq(feedbackTable.pageUrl, query.pageUrl));
      if (query.status) filters.push(eq(feedbackTable.status, query.status));
      // SDK clients pass `excludeArchived: true` so archived pins don't keep
      // rendering on the prototype. An explicit `status` filter wins, so a
      // dashboard can still ask for archived items on demand.
      else if (query.excludeArchived) filters.push(ne(feedbackTable.status, "archived"));
      const rows = await db
        .select()
        .from(feedbackTable)
        .where(and(...filters))
        .orderBy(desc(feedbackTable.createdAt))
        .limit(200);
      return rows.map(rowToFeedback);
    },

    async get(id) {
      const [row] = await db.select().from(feedbackTable).where(eq(feedbackTable.id, id)).limit(1);
      return row ? rowToFeedback(row) : null;
    },

    async create(input) {
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

    async reply(id, comment) {
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

    async setStatus(id, status: FeedbackStatus) {
      const [row] = await db
        .update(feedbackTable)
        .set({ status, updatedAt: new Date() })
        .where(eq(feedbackTable.id, id))
        .returning();
      return row ? rowToFeedback(row) : null;
    },

    async setCoordinates(id, coordinates: FeedbackCoordinates) {
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

    async attachScreenshot(id, key: string) {
      const [row] = await db
        .update(feedbackTable)
        .set({ screenshotKey: key, updatedAt: new Date() })
        .where(eq(feedbackTable.id, id))
        .returning();
      return row ? rowToFeedback(row) : null;
    },
  };
}

// Note-to-future-me: silenced "unused" for the few helpers we re-exported in
// case routes need raw access during a future debug session.
void count;
