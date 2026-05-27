/**
 * End-to-end smoke for the rewritten API. Walks the dashboard auth flow,
 * creates a project, issues a key, and exercises the SDK ingest endpoints.
 *
 *   bun run scripts/e2e-smoke.ts
 *
 * Expects the API on http://localhost:8787 (override with SMOKE_API_URL).
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const API = process.env.SMOKE_API_URL ?? "http://localhost:8787";
const STORAGE_DIR = process.env.SMOKE_STORAGE_DIR
  ? path.resolve(process.env.SMOKE_STORAGE_DIR)
  : path.resolve(process.cwd(), "apps/api/data/screenshots");

let cookie = "";
let projectKey = "";
let createdId = "";
const slug = `smoke-${Date.now().toString(36)}`;
const email = `${slug}@example.com`;

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

interface Step {
  name: string;
  run(): Promise<void>;
}

async function jsonFetch<T>(method: string, url: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${url} → ${res.status}: ${text}`);
  }
  // Capture set-cookie if present so subsequent requests are authenticated.
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0]!;
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

const steps: Step[] = [
  {
    name: "API health responds OK",
    async run() {
      const res = await fetch(`${API}/health`);
      if (!res.ok) throw new Error(`health ${res.status}`);
    },
  },
  {
    name: "signup + cookie session",
    async run() {
      await jsonFetch("POST", `${API}/v1/auth/signup`, { email, password: "supersafepw", name: "Smoke" });
      if (!cookie) throw new Error("no session cookie returned");
      await jsonFetch("GET", `${API}/v1/auth/me`);
    },
  },
  {
    name: "create project",
    async run() {
      await jsonFetch("POST", `${API}/v1/projects`, { slug, name: "Smoke", description: "e2e" });
    },
  },
  {
    name: "issue project API key (returned once)",
    async run() {
      const res = await jsonFetch<{ key: string }>("POST", `${API}/v1/projects/${slug}/keys`, {});
      if (!res.key.startsWith("mp_")) throw new Error("unexpected key prefix");
      projectKey = res.key;
    },
  },
  {
    name: "SDK POST /v1/feedback creates a pin (no projectId in body)",
    async run() {
      const res = await jsonFetch<{ id: string; projectId: string }>(
        "POST",
        `${API}/v1/feedback`,
        {
          pageUrl: "/checkout",
          selector: "[data-feedback-id='submit-btn']",
          coordinates: { xPercent: 0.72, yPercent: 0.31, xPx: 1037, yPx: 279 },
          viewport: { width: 1440, height: 900, devicePixelRatio: 2 },
          comment: { author: { name: "Smoke" }, body: "needs label review" },
        },
        { "x-feedback-key": projectKey }
      );
      if (res.projectId !== slug) throw new Error(`projectId mismatch: ${res.projectId}`);
      createdId = res.id;
    },
  },
  {
    name: "SDK GET /v1/feedback returns the pin scoped by key",
    async run() {
      const res = await jsonFetch<{ items: { id: string }[] }>(
        "GET",
        `${API}/v1/feedback`,
        undefined,
        { "x-feedback-key": projectKey }
      );
      if (!res.items.find((p) => p.id === createdId)) throw new Error("pin missing in scoped list");
    },
  },
  {
    name: "Dashboard list scoped to owner",
    async run() {
      const res = await jsonFetch<{ items: { slug: string; openFeedback: number }[] }>(
        "GET",
        `${API}/v1/projects`
      );
      const project = res.items.find((p) => p.slug === slug);
      if (!project) throw new Error("project missing in dashboard list");
      if (project.openFeedback !== 1) throw new Error(`expected 1 open, got ${project.openFeedback}`);
    },
  },
  {
    name: "Status PATCH transitions open → resolved",
    async run() {
      const res = await jsonFetch<{ status: string }>(
        "PATCH",
        `${API}/v1/feedback/${createdId}`,
        { status: "resolved" }
      );
      if (res.status !== "resolved") throw new Error("status did not transition");
    },
  },
  {
    name: "PATCH coordinates moves the pin",
    async run() {
      const next = { xPercent: 0.1, yPercent: 0.2, xPx: 12, yPx: 34 };
      const res = await jsonFetch<{ coordinates: typeof next }>(
        "PATCH",
        `${API}/v1/feedback/${createdId}/coordinates`,
        { coordinates: next },
        { "x-feedback-key": projectKey }
      );
      if (res.coordinates.xPercent !== next.xPercent) throw new Error("xPercent not persisted");
    },
  },
  {
    name: "Screenshot upload writes to disk",
    async run() {
      const form = new FormData();
      form.append("file", new Blob([PNG], { type: "image/png" }), "shot.png");
      const res = await fetch(`${API}/v1/feedback/${createdId}/screenshot`, {
        method: "POST",
        headers: { "x-feedback-key": projectKey },
        body: form,
      });
      if (!res.ok) throw new Error(`upload ${res.status}`);
      const onDisk = path.join(STORAGE_DIR, "screenshots", `${createdId}.png`);
      if (!existsSync(onDisk)) {
        const dirContents = existsSync(STORAGE_DIR) ? readdirSync(STORAGE_DIR).join(", ") : "(missing dir)";
        throw new Error(`file not on disk at ${onDisk}; dir: ${dirContents}`);
      }
    },
  },
  {
    name: "screenshot fetch returns image/png",
    async run() {
      const res = await fetch(`${API}/v1/feedback/${createdId}/screenshot`);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      if (res.headers.get("content-type") !== "image/png") throw new Error("wrong content-type");
    },
  },
  {
    name: "ingest without key is rejected",
    async run() {
      const res = await fetch(`${API}/v1/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageUrl: "/", selector: "#x", coordinates: { xPercent: 0, yPercent: 0, xPx: 0, yPx: 0 }, viewport: { width: 1, height: 1, devicePixelRatio: 1 } }),
      });
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
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
