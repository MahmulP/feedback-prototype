import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Feedback } from "@mahmulp/shared-types";
import { createNotifier } from "./notifications.js";
import type { Mailer, SendMailInput } from "./mailer.js";
import type { ApiEnv } from "./env.js";
import { createLogger } from "./logger.js";
import type { FeedbackStore } from "./store.js";

/**
 * These tests exercise the coalescing logic directly with fake time, a fake
 * mailer, and a minimal fake store. They prove a burst of activity collapses
 * into a single digest email and that the hourly cap holds.
 */

function makeEnv(overrides: Partial<ApiEnv> = {}): ApiEnv {
  return {
    NODE_ENV: "test",
    PORT: 0,
    STORAGE_DIR: "/tmp",
    ALLOWED_ORIGINS: ["*"],
    LOG_LEVEL: "error",
    RATE_LIMIT_INGEST_PER_MIN: 60,
    DATABASE_URL: undefined,
    SESSION_SECRET: "test-secret-32-bytes-long-keep-shh!",
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    EMAIL_DIGEST_WINDOW_SEC: 120,
    EMAIL_MAX_PER_HOUR: 20,
    ...overrides,
  } as ApiEnv;
}

function makeStore(): FeedbackStore {
  // Only getProject + getUserById are used by the notifier.
  return {
    async getProject(slug: string) {
      return {
        id: "prj_1",
        ownerId: "usr_1",
        slug,
        name: "Demo",
        allowedOrigins: [],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };
    },
    async getUserById(id: string) {
      return {
        id,
        email: "owner@example.com",
        name: "Owner",
        createdAt: "2026-01-01T00:00:00Z",
      };
    },
  } as unknown as FeedbackStore;
}

function makeMailer(sent: SendMailInput[]): Mailer {
  return {
    enabled: true,
    async send(input) {
      sent.push(input);
    },
  };
}

function makeFeedback(id: string, body: string): Feedback {
  return {
    id,
    projectId: "demo",
    pageUrl: "/checkout",
    selector: "#submit",
    coordinates: { xPercent: 0.5, yPercent: 0.5, xPx: 10, yPx: 10 },
    viewport: { width: 800, height: 600, devicePixelRatio: 1 },
    status: "open",
    thread: [{ id: `${id}_0`, author: { name: "Spammer" }, body, createdAt: "2026-01-01T00:00:00Z" }],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as Feedback;
}

let sent: SendMailInput[];
let notifier: ReturnType<typeof createNotifier>;

beforeEach(() => {
  vi.useFakeTimers();
  sent = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("notification coalescing", () => {
  it("collapses a burst of feedback into a single digest email", async () => {
    const env = makeEnv({ EMAIL_DIGEST_WINDOW_SEC: 120 });
    notifier = createNotifier({ env, store: makeStore(), mailer: makeMailer(sent), logger: createLogger(env) });

    // 25 spammy submissions inside the window.
    for (let i = 0; i < 25; i++) {
      notifier.notifyNewFeedback(makeFeedback(`fb_${i}`, `spam ${i}`));
    }
    expect(sent).toHaveLength(0); // nothing sent yet — still inside the window

    await vi.advanceTimersByTimeAsync(120_000);
    // flush() resolves on a microtask chain; let it settle.
    await vi.runAllTimersAsync();

    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toContain("25 new feedback updates");
  });

  it("sends immediately when the window is 0", async () => {
    const env = makeEnv({ EMAIL_DIGEST_WINDOW_SEC: 0 });
    notifier = createNotifier({ env, store: makeStore(), mailer: makeMailer(sent), logger: createLogger(env) });

    notifier.notifyNewFeedback(makeFeedback("fb_a", "hello"));
    await vi.runAllTimersAsync();

    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toContain("New feedback");
  });

  it("enforces the per-project hourly cap across windows", async () => {
    const env = makeEnv({ EMAIL_DIGEST_WINDOW_SEC: 1, EMAIL_MAX_PER_HOUR: 2 });
    notifier = createNotifier({ env, store: makeStore(), mailer: makeMailer(sent), logger: createLogger(env) });

    // Three separate windows -> three flush attempts, but cap allows only 2.
    for (let w = 0; w < 3; w++) {
      notifier.notifyNewFeedback(makeFeedback(`fb_w${w}`, `w${w}`));
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.runAllTimersAsync();
    }

    expect(sent).toHaveLength(2);
  });
});
