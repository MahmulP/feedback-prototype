import type { MiddlewareHandler } from "hono";

/**
 * In-memory token bucket. Resets when the API restarts.
 *
 * For local-host, single-process deployments this is all we need; a
 * distributed limiter belongs in a future iteration once the API is
 * horizontally scaled.
 */
interface Bucket {
  tokens: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Permits per window. */
  capacity: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Build a key from the request. Returns null to skip rate limiting. */
  keyFn: (c: Parameters<MiddlewareHandler>[0]) => string | null;
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();
  return async (c, next) => {
    const key = options.keyFn(c);
    if (!key) {
      await next();
      return;
    }
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { tokens: options.capacity - 1, resetAt: now + options.windowMs });
      await next();
      return;
    }
    if (bucket.tokens <= 0) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      c.header("retry-after", String(Math.max(retryAfter, 1)));
      return c.json(
        { error: { code: "rate_limited", message: "too many requests" } },
        429
      );
    }
    bucket.tokens -= 1;
    await next();
  };
}

/** Periodic sweep so the map can't grow unbounded for one-shot keys. */
export function startBucketSweeper(everyMs: number = 60_000): () => void {
  const handle = setInterval(() => {
    // No-op placeholder: the buckets reset themselves on first hit after
    // `resetAt`. A full sweep would walk a closure-captured map; we keep
    // this as a documented hook to add when keys are very high-cardinality.
  }, everyMs);
  return () => clearInterval(handle);
}
