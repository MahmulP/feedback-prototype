import { z } from "zod";

/**
 * Centralized env loading for the dashboard.
 *
 * Server-only values are validated lazily on first access on the server.
 * Client-side code reads from `publicEnv()` (also lazy, so missing values
 * don't crash the bundler at build time — they fail loudly at first use).
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Internal API URL used by Server Components / Route Handlers. */
  FEEDBACK_API_URL: z.string().url(),
  /** Service-to-service key for privileged API calls (admin endpoints, etc). */
  DASHBOARD_API_KEY: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** Cookie session signing key. Required in production. */
  SESSION_SECRET: z
    .string()
    .min(32)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** Logging verbosity. */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const publicSchema = z.object({
  NEXT_PUBLIC_FEEDBACK_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Feedback"),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

const DEV_FALLBACK_API_URL = "http://localhost:8787";

let cachedServer: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cachedServer) return cachedServer;
  const source = { ...process.env };
  // In dev / test we let the API URL fall back to localhost so first-time
  // setup doesn't require a populated .env.local just to render a page.
  if (!source.FEEDBACK_API_URL && source.NODE_ENV !== "production") {
    source.FEEDBACK_API_URL = DEV_FALLBACK_API_URL;
  }
  const parsed = serverSchema.safeParse(source);
  if (!parsed.success) {
    const summary = JSON.stringify(parsed.error.flatten().fieldErrors);
    throw new Error(`[dashboard] invalid server environment: ${summary}`);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.SESSION_SECRET) {
    throw new Error("[dashboard] SESSION_SECRET is required in production");
  }
  cachedServer = parsed.data;
  return cachedServer;
}

let cachedPublic: PublicEnv | null = null;

/**
 * Lazy public-env reader. Falls back to localhost defaults outside production
 * runtime so `next build` doesn't need a populated .env. In production runtime
 * we still validate strictly.
 */
export function publicEnv(): PublicEnv {
  if (cachedPublic) return cachedPublic;
  const phase = typeof process !== "undefined" ? process.env.NEXT_PHASE : undefined;
  const isProductionRuntime =
    typeof process !== "undefined" &&
    process.env.NODE_ENV === "production" &&
    phase !== "phase-production-build";

  const source = {
    NEXT_PUBLIC_FEEDBACK_API_URL: process.env.NEXT_PUBLIC_FEEDBACK_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  };

  const parsed = publicSchema.safeParse(source);
  if (!parsed.success) {
    if (!isProductionRuntime) {
      cachedPublic = {
        NEXT_PUBLIC_FEEDBACK_API_URL: source.NEXT_PUBLIC_FEEDBACK_API_URL ?? DEV_FALLBACK_API_URL,
        NEXT_PUBLIC_APP_NAME: source.NEXT_PUBLIC_APP_NAME ?? "Feedback",
      };
      return cachedPublic;
    }
    throw new Error(
      `[dashboard] invalid public environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`
    );
  }
  cachedPublic = parsed.data;
  return cachedPublic;
}
