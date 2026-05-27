import { z } from "zod";

/**
 * Centralized env loading. The API refuses to boot when required values are
 * missing or malformed.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  STORAGE_DIR: z.string().min(1).default("./data/screenshots"),
  ALLOWED_ORIGINS: z
    .string()
    .default("*")
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    ),
  DATABASE_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  ADMIN_API_KEY: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** Comma-separated `projectId:key` pairs. Empty = no per-project keys. */
  PROJECT_API_KEYS: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** Logging verbosity. */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Permits per minute on SDK ingest endpoints, per key. */
  RATE_LIMIT_INGEST_PER_MIN: z.coerce.number().int().positive().default(60),
});

export type ApiEnv = z.infer<typeof schema>;

let cached: ApiEnv | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    throw new Error(`[api] invalid environment: ${JSON.stringify(formatted)}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper. */
export function _resetEnvForTests() {
  cached = null;
}
