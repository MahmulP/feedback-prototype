import crypto from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import type { ApiEnv } from "./env.js";
import type { FeedbackStore } from "./store.js";
import { readCookie, SESSION_COOKIE, verifySession } from "./session.js";

export type AppVariables = {
  auth: AuthBag;
};
export type AppContext = Context<{ Variables: AppVariables }>;

/**
 * v2 auth model:
 *
 *   - **Dashboard users** authenticate with a cookie session signed by
 *     `SESSION_SECRET`. The dashboard issues + reads the cookie via the API
 *     login route. Every dashboard read or mutation requires it.
 *
 *   - **SDK ingest** (POST/PATCH on a project's feedback) requires a
 *     per-project key passed as `x-feedback-key`. The API hashes the key
 *     and looks up the project; the request is automatically scoped to that
 *     project. There is no cross-project SDK key.
 *
 *   - The screenshot READ endpoint (`GET /v1/feedback/:id/screenshot`)
 *     remains public so dashboard `<img src>` works without forwarding the
 *     session cookie cross-origin.
 */

export function hashApiKey(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  // 32 bytes → 256 bits of entropy, encoded as base32-ish url-safe.
  const raw = crypto.randomBytes(32).toString("base64url");
  const key = `mp_${raw}`;
  return { key, prefix: key.slice(0, 11), hash: hashApiKey(key) };
}

export interface AuthBag {
  user?: { id: string; email: string; name: string };
  scopedProjectId?: string; // project slug (matches Feedback.projectId)
}

export interface AuthDeps {
  env: ApiEnv;
  store: FeedbackStore;
}

/**
 * Populate `c.var.auth` for every request. Routes then use `requireUser`
 * or `requireProjectKey` to enforce specific access.
 */
export function authMiddleware(deps: AuthDeps): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    const bag: AuthBag = {};

    const cookie = readCookie(c.req.header("cookie"), SESSION_COOKIE);
    const session = verifySession(deps.env, cookie);
    if (session) {
      const user = await deps.store.getUserById(session.sub);
      if (user) bag.user = { id: user.id, email: user.email, name: user.name };
    }

    const feedbackKey = c.req.header("x-feedback-key")?.trim();
    if (feedbackKey) {
      const project = await deps.store.resolveProjectByKeyHash(hashApiKey(feedbackKey));
      if (project) bag.scopedProjectId = project.slug;
    }

    c.set("auth", bag);
    await next();
  };
}

function unauthorized(c: AppContext, message: string) {
  return c.json({ error: { code: "unauthorized", message } }, 401);
}

function forbidden(c: AppContext, message: string) {
  return c.json({ error: { code: "forbidden", message } }, 403);
}

/** Reject unless the request carries a valid dashboard session cookie. */
export const requireUser: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const bag = c.var.auth;
  if (!bag?.user) return unauthorized(c, "login required");
  await next();
};

/**
 * Reject unless the request carries a valid project API key. Sets the
 * resolved project slug on the context so route handlers can reach it.
 */
export const requireProjectKey: MiddlewareHandler<{ Variables: AppVariables }> = async (c, next) => {
  const bag = c.var.auth;
  if (!bag?.scopedProjectId) return unauthorized(c, "missing or invalid x-feedback-key");
  await next();
};

/**
 * Enforce that a project-scoped request is only acting on its own project.
 */
export function assertProjectMatches(c: AppContext, projectId: string): Response | null {
  const bag = c.var.auth;
  if (!bag?.scopedProjectId) return null;
  if (bag.scopedProjectId === projectId) return null;
  return forbidden(c, "key not authorized for this project");
}

/**
 * Read the current user from the auth bag. Convenience for routes that already
 * went through `requireUser`.
 */
export function currentUser(c: AppContext): { id: string; email: string; name: string } {
  const bag = c.var.auth;
  if (!bag?.user) throw new Error("currentUser called without requireUser");
  return bag.user;
}
