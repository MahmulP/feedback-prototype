import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { parseProjectKeys } from "./auth.js";
import { LocalDiskDriver } from "./storage.js";
import { createInMemoryStore } from "./store.js";

const PNG_HEADER = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "iwk-fb-auth-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function makeApp(envOverrides: Record<string, unknown> = {}) {
  return createApp({
    env: {
      NODE_ENV: "test",
      PORT: 0,
      STORAGE_DIR: tempDir,
      ALLOWED_ORIGINS: ["*"],
      LOG_LEVEL: "error",
      RATE_LIMIT_INGEST_PER_MIN: 60,
      ADMIN_API_KEY: undefined,
      PROJECT_API_KEYS: undefined,
      DATABASE_URL: undefined,
      ...envOverrides,
    } as Parameters<typeof createApp>[0]["env"],
    store: createInMemoryStore(),
    storage: new (LocalDiskDriver as unknown as new (opts: { rootDir: string }) => LocalDiskDriver)({
      rootDir: tempDir,
    }),
  });
}

const baseFeedback = {
  projectId: "proj-a",
  pageUrl: "/",
  selector: "#x",
  coordinates: { xPercent: 0.5, yPercent: 0.5, xPx: 100, yPx: 100 },
  viewport: { width: 1024, height: 768, devicePixelRatio: 1 },
};

describe("parseProjectKeys", () => {
  it("parses comma-separated entries", () => {
    expect(parseProjectKeys("a:keya,b:keyb")).toEqual([
      { projectId: "a", key: "keya" },
      { projectId: "b", key: "keyb" },
    ]);
  });
  it("rejects malformed entries", () => {
    expect(() => parseProjectKeys("oops-no-colon")).toThrow();
  });
  it("returns [] for empty/undefined", () => {
    expect(parseProjectKeys(undefined)).toEqual([]);
    expect(parseProjectKeys("")).toEqual([]);
  });
});

describe("auth", () => {
  it("runs open when no keys are configured (back-compat for local dev)", async () => {
    const app = makeApp();
    const res = await app.fetch(
      new Request("http://t/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(baseFeedback),
      })
    );
    expect(res.status).toBe(201);
  });

  it("rejects ingest without a key once auth is configured", async () => {
    const app = makeApp({ ADMIN_API_KEY: "admin-key", PROJECT_API_KEYS: "proj-a:proj-key" });
    const res = await app.fetch(
      new Request("http://t/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(baseFeedback),
      })
    );
    expect(res.status).toBe(401);
  });

  it("accepts ingest with a project key", async () => {
    const app = makeApp({ ADMIN_API_KEY: "admin-key", PROJECT_API_KEYS: "proj-a:proj-key" });
    const res = await app.fetch(
      new Request("http://t/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json", "x-feedback-key": "proj-key" },
        body: JSON.stringify(baseFeedback),
      })
    );
    expect(res.status).toBe(201);
  });

  it("rejects when the project key is for a different project", async () => {
    const app = makeApp({ PROJECT_API_KEYS: "proj-a:proj-key,proj-b:other-key" });
    const res = await app.fetch(
      new Request("http://t/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json", "x-feedback-key": "other-key" },
        body: JSON.stringify(baseFeedback),
      })
    );
    expect(res.status).toBe(403);
  });

  it("requires admin key for dashboard reads", async () => {
    const app = makeApp({ ADMIN_API_KEY: "admin-key" });
    const open = await app.fetch(new Request("http://t/v1/projects"));
    expect(open.status).toBe(401);
    const ok = await app.fetch(
      new Request("http://t/v1/projects", { headers: { "x-dashboard-key": "admin-key" } })
    );
    expect(ok.status).toBe(200);
  });

  it("admin key can also be used as ingest", async () => {
    const app = makeApp({ ADMIN_API_KEY: "admin-key" });
    const res = await app.fetch(
      new Request("http://t/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json", "x-feedback-key": "admin-key" },
        body: JSON.stringify(baseFeedback),
      })
    );
    expect(res.status).toBe(201);
  });

  it("status PATCH requires admin key (dashboard route)", async () => {
    const app = makeApp({ ADMIN_API_KEY: "admin-key" });
    const created = await app.fetch(
      new Request("http://t/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json", "x-feedback-key": "admin-key" },
        body: JSON.stringify(baseFeedback),
      })
    );
    const fb = (await created.json()) as { id: string };

    // Without the admin key — rejected.
    const without = await app.fetch(
      new Request(`http://t/v1/feedback/${fb.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      })
    );
    expect(without.status).toBe(401);

    const withAdmin = await app.fetch(
      new Request(`http://t/v1/feedback/${fb.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-dashboard-key": "admin-key" },
        body: JSON.stringify({ status: "resolved" }),
      })
    );
    expect(withAdmin.status).toBe(200);
  });

  it("screenshot read remains public so dashboard <img src> works", async () => {
    const app = makeApp({ ADMIN_API_KEY: "admin-key" });
    // Create + upload first.
    const created = await app.fetch(
      new Request("http://t/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json", "x-feedback-key": "admin-key" },
        body: JSON.stringify(baseFeedback),
      })
    );
    const fb = (await created.json()) as { id: string };
    const png = new Uint8Array([...PNG_HEADER, 0xff, 0xff, 0xff]);
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), "shot.png");
    await app.fetch(
      new Request(`http://t/v1/feedback/${fb.id}/screenshot`, {
        method: "POST",
        headers: { "x-feedback-key": "admin-key" },
        body: form,
      })
    );

    const fetchShot = await app.fetch(new Request(`http://t/v1/feedback/${fb.id}/screenshot`));
    expect(fetchShot.status).toBe(200);
  });
});

describe("rate limiting", () => {
  it("returns 429 once the per-key budget is spent", async () => {
    const app = makeApp({ ADMIN_API_KEY: "admin-key", RATE_LIMIT_INGEST_PER_MIN: 2 });
    const send = () =>
      app.fetch(
        new Request("http://t/v1/feedback", {
          method: "POST",
          headers: { "content-type": "application/json", "x-feedback-key": "admin-key" },
          body: JSON.stringify(baseFeedback),
        })
      );
    const a = await send();
    const b = await send();
    const c = await send();
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(c.status).toBe(429);
    expect(c.headers.get("retry-after")).toBeTruthy();
  });
});
