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
  /** HMAC secret for dashboard cookie sessions. Required in production. */
  SESSION_SECRET: z
    .string()
    .min(32)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** Logging verbosity. */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Permits per minute on SDK ingest endpoints, per key. */
  RATE_LIMIT_INGEST_PER_MIN: z.coerce.number().int().positive().default(60),

  // ---- SMTP / email notifications (all optional) ----
  // Email is enabled only when SMTP_HOST and SMTP_FROM are both set.
  /** SMTP server hostname, e.g. smtp.gmail.com. */
  SMTP_HOST: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** SMTP port. 587 (STARTTLS) by default; use 465 for implicit TLS. */
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  /** Use implicit TLS (true for port 465). Defaults to false (STARTTLS). */
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((s) => s === "true"),
  /** SMTP auth username. Optional for unauthenticated relays. */
  SMTP_USER: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** SMTP auth password / app password. */
  SMTP_PASS: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** From header, e.g. "Feedback <noreply@example.com>" or "noreply@example.com". */
  SMTP_FROM: z
    .string()
    .min(1)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /** Public dashboard base URL used to build links in emails, e.g. https://prototype.iwkapps.com. */
  DASHBOARD_URL: z
    .string()
    .url()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /**
   * Coalescing window (seconds) for owner notification emails. Activity for a
   * project within this window is batched into ONE digest email instead of one
   * email per comment. This is the main defense against form-spam blowing
   * through an SMTP daily quota. Set to 0 to send immediately (no batching).
   */
  EMAIL_DIGEST_WINDOW_SEC: z.coerce.number().int().min(0).default(120),
  /**
   * Hard cap on notification emails per project per rolling hour. Backstop in
   * case the digest window is set very short. Set to 0 to disable the cap.
   */
  EMAIL_MAX_PER_HOUR: z.coerce.number().int().min(0).default(20),
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

export function _resetEnvForTests() {
  cached = null;
}
