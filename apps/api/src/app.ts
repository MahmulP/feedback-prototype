import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  assertProjectAllowed,
  authMiddleware,
  buildAuthOptions,
  requireAdminKey,
  requireSdkKey,
} from "./auth.js";
import type { ApiEnv } from "./env.js";
import { createLogger, loggingMiddleware, type Logger } from "./logger.js";
import { rateLimit } from "./rate-limit.js";
import { detectImageMime, LocalDiskDriver, type StorageDriver } from "./storage.js";
import { createInMemoryStore, type FeedbackStore } from "./store.js";
import {
  commentInputSchema,
  coordinatesUpdateSchema,
  createFeedbackSchema,
  listQuerySchema,
  statusUpdateSchema,
} from "./schemas.js";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5 MB

export interface AppDeps {
  env: ApiEnv;
  store: FeedbackStore;
  storage: StorageDriver;
  logger?: Logger;
}

/**
 * Build the Hono app. Dependencies are injected so tests can swap
 * the store and storage driver for in-memory equivalents.
 */
export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  const logger = deps.logger ?? createLogger(deps.env);
  const authOptions = buildAuthOptions(deps.env);

  // Logging first, so even rejected requests leave a trace.
  app.use("/*", loggingMiddleware(logger));

  // CORS — explicit list when configured, allow-all in dev only.
  const allowedOrigins = deps.env.ALLOWED_ORIGINS;
  app.use(
    "/*",
    cors({
      origin: (origin) => {
        if (allowedOrigins.includes("*")) return origin ?? "*";
        if (origin && allowedOrigins.includes(origin)) return origin;
        return null;
      },
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["content-type", "x-feedback-key", "x-dashboard-key", "authorization"],
      credentials: false,
    })
  );

  app.use("/v1/*", authMiddleware(authOptions));

  // Per-key rate limiting on ingest. Identifies callers by the x-feedback-key
  // header so a misbehaving SDK can't drown out legitimate ones.
  const ingestRateLimit = rateLimit({
    capacity: deps.env.RATE_LIMIT_INGEST_PER_MIN,
    windowMs: 60_000,
    keyFn: (c) => {
      const key = c.req.header("x-feedback-key") ?? c.req.header("x-dashboard-key");
      if (!key) {
        return c.req.header("x-forwarded-for") ?? "anon";
      }
      return `key:${key}`;
    },
  });

  // Health
  app.get("/health", (c) => c.json({ ok: true }));

  // ---- Dashboard reads ----
  app.get("/v1/projects", requireAdminKey, async (c) => {
    const items = await deps.store.listProjects();
    return c.json({ items });
  });

  app.get("/v1/feedback", requireAdminKey, async (c) => {
    const parsed = listQuerySchema.safeParse({
      projectId: c.req.query("projectId"),
      pageUrl: c.req.query("pageUrl") ?? undefined,
      status: c.req.query("status") ?? undefined,
    });
    if (!parsed.success) {
      return c.json({ error: { code: "validation", message: parsed.error.message } }, 400);
    }
    const items = await deps.store.list(parsed.data);
    return c.json({ items });
  });

  app.get("/v1/feedback/:id", requireAdminKey, async (c) => {
    const id = c.req.param("id");
    const fb = await deps.store.get(id);
    if (!fb) {
      return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    }
    return c.json(fb);
  });

  // ---- SDK ingest ----
  app.post("/v1/feedback", requireSdkKey, ingestRateLimit, async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "validation", message: "invalid JSON body" } }, 400);
    }
    const parsed = createFeedbackSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "validation", message: parsed.error.message } }, 400);
    }
    const blocked = assertProjectAllowed(c, parsed.data.projectId);
    if (blocked) return blocked;
    const created = await deps.store.create(parsed.data);
    return c.json(created, 201);
  });

  app.post("/v1/feedback/:id/comments", requireSdkKey, ingestRateLimit, async (c) => {
    const id = c.req.param("id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "validation", message: "invalid JSON body" } }, 400);
    }
    const parsed = commentInputSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "validation", message: parsed.error.message } }, 400);
    }
    const existing = await deps.store.get(id);
    if (!existing) {
      return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    }
    const blocked = assertProjectAllowed(c, existing.projectId);
    if (blocked) return blocked;
    const updated = await deps.store.reply(id, parsed.data);
    if (!updated) {
      return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    }
    return c.json(updated);
  });

  // ---- Status (admin only — the dashboard manages this) ----
  app.patch("/v1/feedback/:id", requireAdminKey, async (c) => {
    const id = c.req.param("id");
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "validation", message: "invalid JSON body" } }, 400);
    }
    const parsed = statusUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "validation", message: parsed.error.message } }, 400);
    }
    const updated = await deps.store.setStatus(id, parsed.data.status);
    if (!updated) {
      return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    }
    return c.json(updated);
  });

  // ---- Move pin (SDK ingest — repositioning a pin via drag) ----
  app.patch("/v1/feedback/:id/coordinates", requireSdkKey, ingestRateLimit, async (c) => {
    const id = c.req.param("id");
    const existing = await deps.store.get(id);
    if (!existing) {
      return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    }
    const blocked = assertProjectAllowed(c, existing.projectId);
    if (blocked) return blocked;
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "validation", message: "invalid JSON body" } }, 400);
    }
    const parsed = coordinatesUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "validation", message: parsed.error.message } }, 400);
    }
    const updated = await deps.store.setCoordinates(id, parsed.data.coordinates);
    if (!updated) {
      return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    }
    return c.json(updated);
  });

  // ---- Screenshot upload ----
  app.post("/v1/feedback/:id/screenshot", requireSdkKey, ingestRateLimit, async (c) => {
    const id = c.req.param("id");
    const existing = await deps.store.get(id);
    if (!existing) {
      return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    }
    const blocked = assertProjectAllowed(c, existing.projectId);
    if (blocked) return blocked;

    let form: FormData;
    try {
      form = await c.req.formData();
    } catch {
      return c.json({ error: { code: "validation", message: "expected multipart form-data" } }, 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.json({ error: { code: "validation", message: "field 'file' is required" } }, 400);
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      return c.json(
        { error: { code: "payload_too_large", message: "screenshot exceeds 5 MB" } },
        413
      );
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = detectImageMime(bytes);
    if (!mime) {
      return c.json(
        { error: { code: "validation", message: "screenshot must be PNG, JPEG, or WebP" } },
        400
      );
    }

    const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : "webp";
    const key = `screenshots/${id}.${ext}`;
    await deps.storage.put(key, bytes, mime);
    const updated = await deps.store.attachScreenshot(id, key);
    if (!updated) {
      return c.json({ error: { code: "feedback_not_found", message: "no such feedback" } }, 404);
    }
    return c.json(updated);
  });

  // ---- Screenshot read (public so <img src> works without auth dance) ----
  app.get("/v1/feedback/:id/screenshot", async (c) => {
    const id = c.req.param("id");
    const fb = await deps.store.get(id);
    if (!fb || !fb.screenshotKey) {
      return c.json({ error: { code: "feedback_not_found", message: "no screenshot" } }, 404);
    }
    const blob = await deps.storage.get(fb.screenshotKey);
    if (!blob) {
      return c.json({ error: { code: "feedback_not_found", message: "no screenshot" } }, 404);
    }
    return new Response(blob.body as BodyInit, {
      status: 200,
      headers: {
        "content-type": blob.contentType,
        "cache-control": "private, max-age=300",
      },
    });
  });

  // Catch-all error handler so unhandled exceptions don't leak stack traces.
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

/**
 * Build the production app from environment configuration.
 */
export async function createAppFromEnv(env: ApiEnv): Promise<Hono> {
  const storage = new LocalDiskDriver({ rootDir: env.STORAGE_DIR });
  await storage.ensureRoot();
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
  return createApp({ env, store, storage });
}
