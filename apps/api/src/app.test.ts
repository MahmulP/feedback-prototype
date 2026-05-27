import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { LocalDiskDriver } from "./storage.js";
import { createInMemoryStore } from "./store.js";

let tempDir: string;
let app: ReturnType<typeof createApp>;

const PNG_HEADER = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "iwk-fb-api-"));
  const storage = new LocalDiskDriver({ rootDir: tempDir });
  await storage.ensureRoot();
  app = createApp({
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
    } as Parameters<typeof createApp>[0]["env"],
    store: createInMemoryStore(),
    storage,
  });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const baseFeedback = {
  projectId: "demo",
  pageUrl: "/",
  selector: "#x",
  coordinates: { xPercent: 0.5, yPercent: 0.5, xPx: 100, yPx: 100 },
  viewport: { width: 1024, height: 768, devicePixelRatio: 1 },
};

async function postJson(path: string, body: unknown) {
  return app.fetch(
    new Request(`http://test.local${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("API routes", () => {
  it("creates and lists feedback", async () => {
    const created = await postJson("/v1/feedback", baseFeedback);
    expect(created.status).toBe(201);
    const fb = await created.json();
    expect(fb.id).toBeTruthy();

    const list = await app.fetch(
      new Request("http://test.local/v1/feedback?projectId=demo")
    );
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe(fb.id);
  });

  it("rejects invalid create payloads", async () => {
    const res = await postJson("/v1/feedback", { projectId: "" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation");
  });

  it("appends a comment to the thread", async () => {
    const created = await postJson("/v1/feedback", baseFeedback);
    const fb = await created.json();
    const replied = await postJson(`/v1/feedback/${fb.id}/comments`, {
      author: { name: "Anita" },
      body: "Looks good",
    });
    expect(replied.status).toBe(200);
    const updated = await replied.json();
    expect(updated.thread).toHaveLength(1);
    expect(updated.thread[0].body).toBe("Looks good");
  });

  it("transitions status with PATCH", async () => {
    const created = await postJson("/v1/feedback", baseFeedback);
    const fb = await created.json();
    const res = await app.fetch(
      new Request(`http://test.local/v1/feedback/${fb.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      })
    );
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.status).toBe("resolved");
  });

  it("returns 404 when patching unknown feedback", async () => {
    const res = await app.fetch(
      new Request("http://test.local/v1/feedback/missing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("uploads, persists, and serves a PNG screenshot", async () => {
    const created = await postJson("/v1/feedback", baseFeedback);
    const fb = await created.json();

    const png = new Uint8Array([...PNG_HEADER, 0xff, 0xff, 0xff]);
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), "shot.png");
    const upload = await app.fetch(
      new Request(`http://test.local/v1/feedback/${fb.id}/screenshot`, {
        method: "POST",
        body: form,
      })
    );
    expect(upload.status).toBe(200);
    const updated = await upload.json();
    expect(updated.screenshotKey).toBe(`screenshots/${fb.id}.png`);

    const fileBytes = await readFile(path.join(tempDir, "screenshots", `${fb.id}.png`));
    expect(fileBytes.byteLength).toBe(png.byteLength);

    const fetchShot = await app.fetch(
      new Request(`http://test.local/v1/feedback/${fb.id}/screenshot`)
    );
    expect(fetchShot.status).toBe(200);
    expect(fetchShot.headers.get("content-type")).toBe("image/png");
  });

  it("rejects screenshots with the wrong magic bytes", async () => {
    const created = await postJson("/v1/feedback", baseFeedback);
    const fb = await created.json();
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([0x01, 0x02])], { type: "image/png" }), "bad.png");
    const upload = await app.fetch(
      new Request(`http://test.local/v1/feedback/${fb.id}/screenshot`, {
        method: "POST",
        body: form,
      })
    );
    expect(upload.status).toBe(400);
  });

  it("rejects screenshots over 5 MB", async () => {
    const created = await postJson("/v1/feedback", baseFeedback);
    const fb = await created.json();
    const big = new Uint8Array(5 * 1024 * 1024 + 1);
    big.set(PNG_HEADER, 0);
    const form = new FormData();
    form.append("file", new Blob([big], { type: "image/png" }), "big.png");
    const upload = await app.fetch(
      new Request(`http://test.local/v1/feedback/${fb.id}/screenshot`, {
        method: "POST",
        body: form,
      })
    );
    expect(upload.status).toBe(413);
  });

  it("returns 404 for screenshot on missing feedback", async () => {
    const res = await app.fetch(new Request("http://test.local/v1/feedback/nope/screenshot"));
    expect(res.status).toBe(404);
  });

  it("PATCH /v1/feedback/:id/coordinates persists a moved pin", async () => {
    const created = await postJson("/v1/feedback", baseFeedback);
    const fb = await created.json();
    const next = { xPercent: 0.1, yPercent: 0.2, xPx: 12, yPx: 34 };
    const res = await app.fetch(
      new Request(`http://test.local/v1/feedback/${fb.id}/coordinates`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ coordinates: next }),
      })
    );
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.coordinates).toEqual(next);
  });
});
