import type { MiddlewareHandler } from "hono";
import type { ApiEnv } from "./env.js";

/**
 * Minimal structured logger. Emits one JSON line per request to stdout, with
 * fields the steering doc requires: method, path, status, durationMs,
 * requestId, projectId (when known).
 */

const LEVEL_RANK: Record<NonNullable<ApiEnv["LOG_LEVEL"]>, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

export function createLogger(env: ApiEnv): Logger {
  const minRank = LEVEL_RANK[env.LOG_LEVEL];

  function write(level: keyof typeof LEVEL_RANK, msg: string, fields?: Record<string, unknown>) {
    if (LEVEL_RANK[level] < minRank) return;
    const line = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...(fields ?? {}),
    };
    const text = JSON.stringify(line);
    if (level === "error" || level === "warn") {
      console.error(text);
    } else {
      console.log(text);
    }
  }

  return {
    debug: (m, f) => write("debug", m, f),
    info: (m, f) => write("info", m, f),
    warn: (m, f) => write("warn", m, f),
    error: (m, f) => write("error", m, f),
  };
}

function newRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loggingMiddleware(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? newRequestId();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    const start = Date.now();
    let errored: unknown = null;
    try {
      await next();
    } catch (err) {
      errored = err;
      throw err;
    } finally {
      const durationMs = Date.now() - start;
      const projectId =
        c.req.query("projectId") ??
        ((c.var as { projectIdHint?: string }).projectIdHint ?? undefined);
      const fields = {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
        requestId,
        ...(projectId ? { projectId } : {}),
      };
      if (errored) {
        logger.error("request failed", {
          ...fields,
          error: errored instanceof Error ? errored.message : String(errored),
        });
      } else if (c.res.status >= 500) {
        logger.error("request 5xx", fields);
      } else if (c.res.status >= 400) {
        logger.warn("request 4xx", fields);
      } else {
        logger.info("request", fields);
      }
    }
  };
}
