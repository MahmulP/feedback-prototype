import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  assertProjectMatches,
  authMiddleware,
  type AppVariables,
  currentUser,
  generateApiKey,
  requireProjectKey,
  requireUser,
} from "./auth.js";
import type { ApiEnv } from "./env.js";
import { createLogger, loggingMiddleware, type Logger } from "./logger.js";
import { hashPassword, verifyPassword } from "./password.js";
import { rateLimit } from "./rate-limit.js";
import {
  addMemberSchema,
  commentInputSchema,
  coordinatesUpdateSchema,
  createFeedbackSchema,
  listQuerySchema,
  loginSchema,
  projectCreateSchema,
  projectUpdateSchema,
  signupSchema,
  statusUpdateSchema,
} from "./schemas.js";
import { sessionClearHeader, sessionCookieHeader, signSession } from "./session.js";
import { detectImageMime, LocalDiskDriver, type StorageDriver } from "./storage.js";
import { createInMemoryStore, type FeedbackStore } from "./store.js";
import { createMailer } from "./mailer.js";
import { createNotifier, NoopNotifier, type Notifier } from "./notifications.js";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export interface AppDeps {
  env: ApiEnv;
  store: FeedbackStore;
  storage: StorageDriver;
  logger?: Logger;
  notifier?: Notifier;
}

export function createApp(deps: AppDeps): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>();
  const logger = deps.logger ?? createLogger(deps.env);
  const notifier = deps.notifier ?? new NoopNotifier();

  app.use("/*", loggingMiddleware(logger));

  app.use(
    "/*",
    cors({
      origin: (origin) => {
        if (deps.env.ALLOWED_ORIGINS.includes("*")) return origin ?? "*";
        if (origin && deps.env.ALLOWED_ORIGINS.includes(origin)) return origin;
        return null;
      },
      allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["content-type", "x-feedback-key", "authorization"],
      credentials: true,
    })
  );

  app.use("/*", authMiddleware({ env: deps.env, store: deps.store }));

  const ingestRateLimit = rateLimit({
    capacity: deps.env.RATE_LIMIT_INGEST_PER_MIN,
    windowMs: 60_000,
    keyFn: (c) => {
      const k = c.req.header("x-feedback-key");
      if (k) return `key:${k}`;
      return c.req.header("x-forwarded-for") ?? "anon";
    },
  });

  // -------------------- Health --------------------
  app.get("/health", (c) => c.json({ ok: true }));

  // -------------------- Auth ----------------------
  app.post("/v1/auth/signup", async (c) => {
    const body = await safeJson(c);
    if (body == null) return validation(c, "invalid JSON body");
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) return validation(c, parsed.error.message);
    let user;
    try {
      const passwordHash = await hashPassword(parsed.data.password);
      user = await deps.store.createUser({
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
      });
    } catch (err) {
      if ((err as Error).message === "user_exists") {
        return c.json({ error: { code: "user_exists", message: "email already registered" } }, 409);
      }
      throw err;
    }
    const token = signSession(deps.env, user.id);
    c.header("set-cookie", sessionCookieHeader(deps.env, token));
    return c.json({ user }, 201);
  });

  app.post("/v1/auth/login", async (c) => {
    const body = await safeJson(c);
    if (body == null) return validation(c, "invalid JSON body");
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return validation(c, parsed.error.message);
    const record = await deps.store.getUserByEmail(parsed.data.email);
    if (!record) return c.json({ error: { code: "invalid_credentials", message: "wrong email or password" } }, 401);
    const ok = await verifyPassword(parsed.data.password, record.passwordHash);
    if (!ok) return c.json({ error: { code: "invalid_credentials", message: "wrong email or password" } }, 401);
    const token = signSession(deps.env, record.user.id);
    c.header("set-cookie", sessionCookieHeader(deps.env, token));
    return c.json({ user: record.user });
  });

  app.post("/v1/auth/logout", async (c) => {
    c.header("set-cookie", sessionClearHeader(deps.env));
    return c.json({ ok: true });
  });

  app.get("/v1/auth/me", requireUser, async (c) => {
    return c.json({ user: currentUser(c) });
  });

  // -------------------- Projects (dashboard) --------------------
  app.get("/v1/projects", requireUser, async (c) => {
    const items = await deps.store.listProjectsForUser(currentUser(c).id);
    return c.json({ items });
  });

  app.post("/v1/projects", requireUser, async (c) => {
    const body = await safeJson(c);
    if (body == null) return validation(c, "invalid JSON body");
    const parsed = projectCreateSchema.safeParse(body);
    if (!parsed.success) return validation(c, parsed.error.message);
    try {
      const project = await deps.store.createProject(currentUser(c).id, parsed.data);
      return c.json(project, 201);
    } catch (err) {
      if ((err as Error).message === "project_exists") {
        return c.json(
          { error: { code: "project_exists", message: "slug already in use" } },
          409
        );
      }
      throw err;
    }
  });

  app.get("/v1/projects/:slug", requireUser, async (c) => {
    const slug = c.req.param("slug");
    const access = await deps.store.getProjectForUser(slug, currentUser(c).id);
    if (!access) {
      return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    }
    return c.json({ ...access.project, role: access.role });
  });

  app.patch("/v1/projects/:slug", requireUser, async (c) => {
    const slug = c.req.param("slug");
    const body = await safeJson(c);
    if (body == null) return validation(c, "invalid JSON body");
    const parsed = projectUpdateSchema.safeParse(body);
    if (!parsed.success) return validation(c, parsed.error.message);
    const access = await deps.store.getProjectForUser(slug, currentUser(c).id);
    if (!access) return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    if (access.role !== "owner") {
      return c.json({ error: { code: "forbidden", message: "only the owner can edit this project" } }, 403);
    }
    const updated = await deps.store.updateProject(slug, currentUser(c).id, parsed.data);
    if (!updated) return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    return c.json(updated);
  });

  app.delete("/v1/projects/:slug", requireUser, async (c) => {
    const slug = c.req.param("slug");
    const access = await deps.store.getProjectForUser(slug, currentUser(c).id);
    if (!access) return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    if (access.role !== "owner") {
      return c.json({ error: { code: "forbidden", message: "only the owner can delete this project" } }, 403);
    }
    const ok = await deps.store.deleteProject(slug, currentUser(c).id);
    if (!ok) return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    return c.json({ ok: true });
  });

  // -------------------- Project members (sharing, owner-managed) --------------------
  app.get("/v1/projects/:slug/members", requireUser, async (c) => {
    const slug = c.req.param("slug");
    const access = await deps.store.getProjectForUser(slug, currentUser(c).id);
    if (!access) return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    const items = await deps.store.listProjectMembers(access.project.id);
    return c.json({ items });
  });

  app.post("/v1/projects/:slug/members", requireUser, async (c) => {
    const slug = c.req.param("slug");
    const body = await safeJson(c);
    if (body == null) return validation(c, "invalid JSON body");
    const parsed = addMemberSchema.safeParse(body);
    if (!parsed.success) return validation(c, parsed.error.message);
    const access = await deps.store.getProjectForUser(slug, currentUser(c).id);
    if (!access) return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    if (access.role !== "owner") {
      return c.json({ error: { code: "forbidden", message: "only the owner can share this project" } }, 403);
    }
    const target = await deps.store.getUserByEmail(parsed.data.email);
    if (!target) {
      return c.json({ error: { code: "user_not_found", message: "no registered user with that email" } }, 404);
    }
    if (target.user.id === access.project.ownerId) {
      return c.json({ error: { code: "cannot_add_owner", message: "the owner already has full access" } }, 409);
    }
    try {
      const member = await deps.store.addProjectMember(
        access.project.id,
        { id: target.user.id, email: target.user.email, name: target.user.name },
        parsed.data.role
      );
      return c.json(member, 201);
    } catch (err) {
      if ((err as Error).message === "already_member") {
        return c.json({ error: { code: "already_member", message: "user already has access" } }, 409);
      }
      throw err;
    }
  });

  app.delete("/v1/projects/:slug/members/:memberId", requireUser, async (c) => {
    const slug = c.req.param("slug");
    const memberId = c.req.param("memberId");
    const access = await deps.store.getProjectForUser(slug, currentUser(c).id);
    if (!access) return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    if (access.role !== "owner") {
      return c.json({ error: { code: "forbidden", message: "only the owner can manage sharing" } }, 403);
    }
    const ok = await deps.store.removeProjectMember(memberId, access.project.id);
    if (!ok) return c.json({ error: { code: "member_not_found", message: "no such member" } }, 404);
    return c.json({ ok: true });
  });

  // -------------------- Project API keys ------------------------
  app.get("/v1/projects/:slug/keys", requireUser, async (c) => {
    const slug = c.req.param("slug");
    const project = await deps.store.getProject(slug);
    if (!project || project.ownerId !== currentUser(c).id) {
      return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    }
    const items = await deps.store.listProjectApiKeys(project.id);
    return c.json({ items });
  });

  app.post("/v1/projects/:slug/keys", requireUser, async (c) => {
    const slug = c.req.param("slug");
    const project = await deps.store.getProject(slug);
    if (!project || project.ownerId !== currentUser(c).id) {
      return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    }
    const issued = generateApiKey();
    const meta = await deps.store.createProjectApiKey(project.id, {
      keyHash: issued.hash,
      prefix: issued.prefix,
    });
    // The plaintext key is returned **once**, then the API only stores the hash.
    return c.json({ ...meta, key: issued.key }, 201);
  });

  app.delete("/v1/projects/:slug/keys/:keyId", requireUser, async (c) => {
    const slug = c.req.param("slug");
    const keyId = c.req.param("keyId");
    const project = await deps.store.getProject(slug);
    if (!project || project.ownerId !== currentUser(c).id) {
      return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    }
    const ok = await deps.store.deleteProjectApiKey(keyId, project.id);
    if (!ok) return c.json({ error: { code: "key_not_found", message: "no such key" } }, 404);
    return c.json({ ok: true });
  });

  // -------------------- Feedback (dashboard reads, owner or member) --------------------
  app.get("/v1/projects/:slug/feedback", requireUser, async (c) => {
    const slug = c.req.param("slug");
    const access = await deps.store.getProjectForUser(slug, currentUser(c).id);
    if (!access) {
      return c.json({ error: { code: "project_not_found", message: "no such project" } }, 404);
    }
    const parsed = listQuerySchema.safeParse({
      pageUrl: c.req.query("pageUrl") ?? undefined,
      status: c.req.query("status") ?? undefined,
    });
    if (!parsed.success) return validation(c, parsed.error.message);
    const items = await deps.store.list({ projectId: access.project.slug, ...parsed.data });
    return c.json({ items });
  });

  app.get("/v1/feedback/:id", requireUser, async (c) => {
    const id = c.req.param("id");
    const fb = await deps.store.get(id);
    if (!fb) return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    const access = await deps.store.getProjectForUser(fb.projectId, currentUser(c).id);
    if (!access) {
      return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    }
    return c.json(fb);
  });

  // Status transitions. Accepts a dashboard owner/editor session OR a matching
  // project key (so the SDK's Resolve/Archive buttons work). Viewers and
  // non-matching keys are rejected.
  app.patch("/v1/feedback/:id", async (c) => {
    const bag = c.var.auth;
    // Reject up-front when the request carries no credentials at all.
    if (!bag?.user && !bag?.scopedProjectId) {
      return c.json({ error: { code: "unauthorized", message: "login or project key required" } }, 401);
    }
    const id = c.req.param("id");
    const body = await safeJson(c);
    if (body == null) return validation(c, "invalid JSON body");
    const parsed = statusUpdateSchema.safeParse(body);
    if (!parsed.success) return validation(c, parsed.error.message);
    const fb = await deps.store.get(id);
    if (!fb) return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    const project = await deps.store.getProject(fb.projectId);
    if (!project) return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);

    let allowed = bag.scopedProjectId === project.slug;
    if (!allowed && bag.user) {
      const access = await deps.store.getProjectForUser(project.slug, bag.user.id);
      // Owners and editors can triage; viewers cannot.
      allowed = !!access && access.role !== "viewer";
    }
    if (!allowed) {
      return c.json({ error: { code: "forbidden", message: "not allowed to change this feedback" } }, 403);
    }

    const updated = await deps.store.setStatus(id, parsed.data.status);
    if (!updated) return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    return c.json(updated);
  });

  app.post("/v1/feedback/:id/comments", async (c) => {
    // Both dashboard users (replies) and SDK keys (rare) can append comments.
    const id = c.req.param("id");
    const body = await safeJson(c);
    if (body == null) return validation(c, "invalid JSON body");
    const parsed = commentInputSchema.safeParse(body);
    if (!parsed.success) return validation(c, parsed.error.message);
    const fb = await deps.store.get(id);
    if (!fb) return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    const project = await deps.store.getProject(fb.projectId);
    if (!project) return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);

    const bag = c.var.auth;
    const isProjectKey = bag?.scopedProjectId === project.slug;
    let isAllowedUser = false;
    if (bag?.user) {
      const access = await deps.store.getProjectForUser(project.slug, bag.user.id);
      // Owners and editors can reply; viewers are read-only.
      isAllowedUser = !!access && access.role !== "viewer";
    }
    if (!isAllowedUser && !isProjectKey) {
      return c.json({ error: { code: "unauthorized", message: "login or project key required" } }, 401);
    }

    const updated = await deps.store.reply(id, parsed.data);
    if (!updated) return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    notifier.notifyNewReply(updated, parsed.data);
    return c.json(updated);
  });

  // -------------------- SDK ingest (project-key scoped) --------------------
  app.post("/v1/feedback", requireProjectKey, ingestRateLimit, async (c) => {
    const body = await safeJson(c);
    if (body == null) return validation(c, "invalid JSON body");
    const parsed = createFeedbackSchema.safeParse(body);
    if (!parsed.success) return validation(c, parsed.error.message);
    const bag = c.var.auth;
    const created = await deps.store.create({
      projectId: bag.scopedProjectId!,
      ...parsed.data,
    });
    notifier.notifyNewFeedback(created);
    return c.json(created, 201);
  });

  // SDK list — scoped by the project key. Lets the SDK render existing pins.
  // Archived items are filtered out by default so old/dismissed pins don't
  // keep rendering on the prototype. The dashboard endpoints don't pass
  // this flag, so reviewers can still see and manage archived items.
  app.get("/v1/feedback", requireProjectKey, async (c) => {
    const bag = c.var.auth;
    const parsed = listQuerySchema.safeParse({
      pageUrl: c.req.query("pageUrl") ?? undefined,
      status: c.req.query("status") ?? undefined,
    });
    if (!parsed.success) return validation(c, parsed.error.message);
    const items = await deps.store.list({
      projectId: bag.scopedProjectId!,
      excludeArchived: true,
      ...parsed.data,
    });
    return c.json({ items });
  });

  app.patch("/v1/feedback/:id/coordinates", requireProjectKey, ingestRateLimit, async (c) => {
    const id = c.req.param("id");
    const fb = await deps.store.get(id);
    if (!fb) return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    const blocked = assertProjectMatches(c, fb.projectId);
    if (blocked) return blocked;
    const body = await safeJson(c);
    if (body == null) return validation(c, "invalid JSON body");
    const parsed = coordinatesUpdateSchema.safeParse(body);
    if (!parsed.success) return validation(c, parsed.error.message);
    const updated = await deps.store.setCoordinates(id, parsed.data.coordinates);
    if (!updated) return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    return c.json(updated);
  });

  app.post("/v1/feedback/:id/screenshot", requireProjectKey, ingestRateLimit, async (c) => {
    const id = c.req.param("id");
    const fb = await deps.store.get(id);
    if (!fb) return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    const blocked = assertProjectMatches(c, fb.projectId);
    if (blocked) return blocked;

    let form: FormData;
    try {
      form = await c.req.formData();
    } catch {
      return validation(c, "expected multipart form-data");
    }
    const file = form.get("file");
    if (!(file instanceof File)) return validation(c, "field 'file' is required");
    if (file.size > MAX_SCREENSHOT_BYTES) {
      return c.json({ error: { code: "payload_too_large", message: "screenshot exceeds 5 MB" } }, 413);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectImageMime(bytes);
    if (!mime) return validation(c, "screenshot must be PNG, JPEG, or WebP");

    const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
    const key = `screenshots/${id}.${ext}`;
    await deps.storage.put(key, bytes, mime);
    const updated = await deps.store.attachScreenshot(id, key);
    if (!updated) return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    return c.json(updated);
  });

  // -------------------- Screenshot read (public) --------------------
  app.get("/v1/feedback/:id/screenshot", async (c) => {
    const id = c.req.param("id");
    const fb = await deps.store.get(id);
    if (!fb || !fb.screenshotKey) {
      return c.json({ error: { code: "feedback_not_found", message: "no screenshot" } }, 404);
    }
    const blob = await deps.storage.get(fb.screenshotKey);
    if (!blob) return c.json({ error: { code: "feedback_not_found", message: "no screenshot" } }, 404);
    return new Response(blob.body as BodyInit, {
      status: 200,
      headers: {
        "content-type": blob.contentType,
        "cache-control": "private, max-age=300",
      },
    });
  });

  app.onError((err, c) => {
    logger.error("unhandled error", {
      method: c.req.method,
      path: c.req.path,
      error: err instanceof Error ? err.message : String(err),
    });
    return c.json({ error: { code: "internal", message: "internal server error" } }, 500);
  });

  return app;
}

async function safeJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

function validation(c: { json: (body: unknown, status: number) => Response }, message: string): Response {
  return c.json({ error: { code: "validation", message } }, 400);
}

export async function createAppFromEnv(env: ApiEnv): Promise<Hono<{ Variables: AppVariables }>> {
  const storage = new LocalDiskDriver({ rootDir: env.STORAGE_DIR });
  await storage.ensureRoot();
  const logger = createLogger(env);
  let store: FeedbackStore;
  if (env.DATABASE_URL) {
    const { createDb } = await import("./db/client.js");
    const { createDbStore } = await import("./db/store.js");
    const handle = createDb(env.DATABASE_URL);
    store = createDbStore(handle.db);
    console.log("[api] using PostgreSQL store");
  } else {
    store = createInMemoryStore();
    console.log("[api] using in-memory store (set DATABASE_URL to persist)");
  }
  const mailer = createMailer(env, logger);
  const notifier = createNotifier({ env, store, mailer, logger });
  return createApp({ env, store, storage, logger, notifier });
}
