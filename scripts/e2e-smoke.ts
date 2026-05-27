/**
 * End-to-end smoke test: drives the API surface that the SDK and dashboard use.
 *
 * Run with:
 *   bun run scripts/e2e-smoke.ts
 *
 * Expects the API to be running on http://localhost:8787 (or override with
 * SMOKE_API_URL).
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const API = process.env.SMOKE_API_URL ?? "http://localhost:8787";
const STORAGE_DIR = process.env.SMOKE_STORAGE_DIR
  ? path.resolve(process.env.SMOKE_STORAGE_DIR)
  : path.resolve(process.cwd(), "apps/api/data/screenshots");

interface Step {
  name: string;
  run(): Promise<void>;
}

let createdId: string | null = null;
let projectId = `smoke-${Date.now().toString(36)}`;

async function jsonFetch<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${url} → ${res.status} ${res.statusText}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

const PNG = Uint8Array.from([
  // 1×1 green PNG
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

const steps: Step[] = [
  {
    name: "API health responds OK",
    async run() {
      const res = await fetch(`${API}/health`);
      if (!res.ok) throw new Error(`health returned ${res.status}`);
      const data = (await res.json()) as { ok: boolean };
      if (!data.ok) throw new Error("health.ok = false");
    },
  },
  {
    name: "SDK-style POST /v1/feedback creates a pin",
    async run() {
      const created = await jsonFetch<{ id: string; status: string; thread: unknown[] }>(
        "POST",
        `${API}/v1/feedback`,
        {
          projectId,
          pageUrl: "/checkout",
          selector: "[data-feedback-id='submit-btn']",
          coordinates: { xPercent: 0.72, yPercent: 0.31, xPx: 1037, yPx: 279 },
          viewport: { width: 1440, height: 900, devicePixelRatio: 2 },
          comment: { author: { name: "Anita" }, body: "Button label should be 'Pay now'" },
        }
      );
      createdId = created.id;
      if (!createdId) throw new Error("create returned no id");
      if (created.status !== "open") throw new Error(`expected status=open, got ${created.status}`);
      if (created.thread.length !== 1) throw new Error("thread length should be 1");
    },
  },
  {
    name: "Dashboard list shows the new pin",
    async run() {
      const list = await jsonFetch<{ items: { id: string }[] }>(
        "GET",
        `${API}/v1/feedback?projectId=${encodeURIComponent(projectId)}`
      );
      if (!list.items.find((f) => f.id === createdId)) {
        throw new Error("created pin missing from list");
      }
    },
  },
  {
    name: "Dashboard project summary aggregates correctly",
    async run() {
      const res = await jsonFetch<{ items: { projectId: string; openFeedback: number; totalFeedback: number }[] }>(
        "GET",
        `${API}/v1/projects`
      );
      const summary = res.items.find((p) => p.projectId === projectId);
      if (!summary) throw new Error("project missing in /v1/projects");
      if (summary.openFeedback !== 1 || summary.totalFeedback !== 1) {
        throw new Error(`unexpected counts: ${JSON.stringify(summary)}`);
      }
    },
  },
  {
    name: "Status PATCH transitions open → resolved",
    async run() {
      const updated = await jsonFetch<{ status: string }>(
        "PATCH",
        `${API}/v1/feedback/${encodeURIComponent(createdId!)}`,
        { status: "resolved" }
      );
      if (updated.status !== "resolved") throw new Error("status did not transition");
    },
  },
  {
    name: "Reply appends to the thread",
    async run() {
      const updated = await jsonFetch<{ thread: { body: string }[] }>(
        "POST",
        `${API}/v1/feedback/${encodeURIComponent(createdId!)}/comments`,
        { author: { name: "Budi" }, body: "Confirmed fixed in #421" }
      );
      if (updated.thread.length !== 2) throw new Error("thread should have 2 comments");
      if (updated.thread[1]?.body !== "Confirmed fixed in #421") {
        throw new Error("reply body not persisted");
      }
    },
  },
  {
    name: "Screenshot upload writes a file to local disk",
    async run() {
      const form = new FormData();
      form.append("file", new Blob([PNG], { type: "image/png" }), "shot.png");
      const res = await fetch(`${API}/v1/feedback/${encodeURIComponent(createdId!)}/screenshot`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`upload returned ${res.status}`);
      const updated = (await res.json()) as { screenshotKey?: string };
      if (!updated.screenshotKey?.endsWith(".png")) {
        throw new Error("screenshotKey not set");
      }
      const onDisk = path.join(STORAGE_DIR, "screenshots", `${createdId!}.png`);
      if (!existsSync(onDisk)) {
        const dirContents = existsSync(STORAGE_DIR) ? readdirSync(STORAGE_DIR).join(", ") : "(missing dir)";
        throw new Error(`screenshot file not on disk at ${onDisk}; dir contents: ${dirContents}`);
      }
    },
  },
  {
    name: "Screenshot fetch returns the bytes with image/png",
    async run() {
      const res = await fetch(`${API}/v1/feedback/${encodeURIComponent(createdId!)}/screenshot`);
      if (!res.ok) throw new Error(`fetch returned ${res.status}`);
      const ct = res.headers.get("content-type");
      if (ct !== "image/png") throw new Error(`unexpected content-type: ${ct}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength !== PNG.byteLength) {
        throw new Error(`size mismatch: got ${buf.byteLength}, expected ${PNG.byteLength}`);
      }
    },
  },
  {
    name: "Validation error on malformed payload",
    async run() {
      const res = await fetch(`${API}/v1/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId: "" }),
      });
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    },
  },
  {
    name: "404 on unknown feedback",
    async run() {
      const res = await fetch(`${API}/v1/feedback/nope`);
      if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`);
    },
  },
  {
    name: "PATCH /v1/feedback/:id/coordinates moves a pin",
    async run() {
      const next = { xPercent: 0.1, yPercent: 0.2, xPx: 12, yPx: 34 };
      const updated = await jsonFetch<{ coordinates: typeof next }>(
        "PATCH",
        `${API}/v1/feedback/${encodeURIComponent(createdId!)}/coordinates`,
        { coordinates: next }
      );
      if (
        updated.coordinates.xPercent !== next.xPercent ||
        updated.coordinates.yPercent !== next.yPercent
      ) {
        throw new Error("coordinates not persisted");
      }
    },
  },
];

async function main() {
  console.log(`smoke: API=${API}`);
  let failed = 0;
  for (const step of steps) {
    process.stdout.write(`  • ${step.name} ... `);
    try {
      await step.run();
      console.log("ok");
    } catch (err) {
      failed++;
      console.log("FAIL");
      console.error(`    ${(err as Error).message}`);
    }
  }
  console.log("");
  console.log(`smoke: ${steps.length - failed}/${steps.length} passed`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
