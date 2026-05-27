import type { Context, MiddlewareHandler } from "hono";
import type { ApiEnv } from "./env.js";

/**
 * Auth model (v1, deliberately minimal):
 *
 *   - **SDK ingest** routes (`POST /v1/feedback`, screenshot upload, etc.)
 *     accept either:
 *       * a per-project key passed as `x-feedback-key`. Keys are configured
 *         via `PROJECT_API_KEYS` (`projectId:key,projectId:key,...`).
 *       * the dashboard's admin key (`ADMIN_API_KEY`), passed as
 *         `x-feedback-key` *or* `x-dashboard-key`.
 *
 *   - **Dashboard read** routes (`GET /v1/feedback`, `GET /v1/projects`,
 *     mutation routes called from the dashboard) accept the admin key as
 *     `x-dashboard-key`.
 *
 *   - When neither `PROJECT_API_KEYS` nor `ADMIN_API_KEY` is configured the
 *     API runs **open** (no auth) — that's local-dev mode. As soon as one
 *     of those env vars is set, every protected route requires an
 *     authenticated request.
 *
 * Public routes (`/health`, `GET /v1/feedback/:id/screenshot`) are always
 * reachable so the dashboard's `<img src>` works without a key flip-flop.
 */

export interface ProjectKey {
  projectId: string;
  key: string;
}

export function parseProjectKeys(value: string | undefined): ProjectKey[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const idx = entry.indexOf(":");
      if (idx <= 0 || idx === entry.length - 1) {
        throw new Error(
          `[api] PROJECT_API_KEYS entry must be 'projectId:key', got '${entry}'`
        );
      }
      return {
        projectId: entry.slice(0, idx).trim(),
        key: entry.slice(idx + 1).trim(),
      };
    });
}

export interface AuthContext {
  /** True when no auth has been configured at all. */
  open: boolean;
  /** True when this request supplied the admin key. */
  isAdmin: boolean;
  /** When set, the project this request's key is scoped to. */
  scopedProjectId: string | null;
}

export interface AuthOptions {
  adminKey: string | undefined;
  projectKeys: ProjectKey[];
}

export function buildAuthOptions(env: ApiEnv): AuthOptions {
  return {
    adminKey: env.ADMIN_API_KEY,
    projectKeys: parseProjectKeys(env.PROJECT_API_KEYS),
  };
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function classify(c: Context, opts: AuthOptions): AuthContext {
  const open = !opts.adminKey && opts.projectKeys.length === 0;
  if (open) {
    return { open: true, isAdmin: false, scopedProjectId: null };
  }
  const dashboardKey = c.req.header("x-dashboard-key")?.trim();
  const feedbackKey = c.req.header("x-feedback-key")?.trim();

  let isAdmin = false;
  if (opts.adminKey) {
    if (
      (dashboardKey && timingSafeEq(dashboardKey, opts.adminKey)) ||
      (feedbackKey && timingSafeEq(feedbackKey, opts.adminKey))
    ) {
      isAdmin = true;
    }
  }

  let scopedProjectId: string | null = null;
  if (feedbackKey) {
    for (const pk of opts.projectKeys) {
      if (timingSafeEq(feedbackKey, pk.key)) {
        scopedProjectId = pk.projectId;
        break;
      }
    }
  }

  return { open: false, isAdmin, scopedProjectId };
}

/** Attach the auth context to every request. Routes can read `c.var.auth`. */
export function authMiddleware(opts: AuthOptions): MiddlewareHandler {
  return async (c, next) => {
    c.set("auth", classify(c, opts));
    await next();
  };
}

function unauthorized(c: Context, message: string) {
  return c.json({ error: { code: "unauthorized", message } }, 401);
}

function forbidden(c: Context, message: string) {
  return c.json({ error: { code: "forbidden", message } }, 403);
}

/**
 * Allow only requests that supplied a valid SDK key (admin or project-scoped).
 * Used for SDK ingest endpoints. When the key is project-scoped, the caller
 * is also constrained to operate against that project (see `assertProjectMatch`).
 */
export const requireSdkKey: MiddlewareHandler = async (c, next) => {
  const auth = c.get("auth") as AuthContext | undefined;
  if (!auth) return unauthorized(c, "auth missing");
  if (auth.open || auth.isAdmin || auth.scopedProjectId) {
    await next();
    return;
  }
  return unauthorized(c, "missing or invalid x-feedback-key");
};

/**
 * Allow only requests authenticated as admin (the dashboard).
 */
export const requireAdminKey: MiddlewareHandler = async (c, next) => {
  const auth = c.get("auth") as AuthContext | undefined;
  if (!auth) return unauthorized(c, "auth missing");
  if (auth.open || auth.isAdmin) {
    await next();
    return;
  }
  return unauthorized(c, "missing or invalid x-dashboard-key");
};

/**
 * If the request is project-scoped (an SDK key for a single project), reject
 * any attempt to reach a different project.
 */
export function assertProjectAllowed(c: Context, projectId: string): Response | null {
  const auth = c.get("auth") as AuthContext | undefined;
  if (!auth || auth.open || auth.isAdmin) return null;
  if (auth.scopedProjectId && auth.scopedProjectId === projectId) return null;
  return forbidden(c, "key not authorized for this project");
}
