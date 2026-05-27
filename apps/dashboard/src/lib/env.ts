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
  if (!source.FEEDBACK_API_URL && source.NODE_ENV !== "production") {
    source.FEEDBACK_API_URL = DEV_FALLBACK_API_URL;
  }
  const parsed = serverSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `[dashboard] invalid server environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`
    );
  }
  cachedServer = parsed.data;
  return cachedServer;
}

let cachedPublic: PublicEnv | null = null;

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
