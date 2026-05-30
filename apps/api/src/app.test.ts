import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { LocalDiskDriver } from "./storage.js";
import { createInMemoryStore } from "./store.js";

const PNG_HEADER = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

let tempDir: string;
let app: ReturnType<typeof createApp>;

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
      DATABASE_URL: undefined,
      SESSION_SECRET: "test-secret-32-bytes-long-keep-shh!",
    } as Parameters<typeof createApp>[0]["env"],
    store: createInMemoryStore(),
    storage,
  });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

interface SessionContext {
  cookie: string;
  user: { id: string; email: string; name: string };
}

async function postJson(path: string, body: unknown, init: RequestInit = {}) {
  return app.fetch(
    new Request(`http://test.local${path}`, {
      method: "POST",
      ...init,
      headers: { "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) },
      body: JSON.stringify(body),
    })
  );
}

async function signup(email = "alice@example.com", password = "hunter2pw"): Promise<SessionContext> {
  const res = await postJson("/v1/auth/signup", { email, password, name: email.split("@")[0] });
  expect(res.status).toBe(201);
  const setCookie = res.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  const body = (await res.json()) as { user: SessionContext["user"] };
  return { cookie: cookie ?? "", user: body.user };
}

async function createProject(session: SessionContext, slug: string, overrides: Record<string, unknown> = {}) {
  const res = await postJson(
    "/v1/projects",
    { slug, name: slug, ...overrides },
    { headers: { cookie: session.cookie } }
  );
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; slug: string };
}

async function issueKey(session: SessionContext, slug: string): Promise<string> {
  const res = await postJson(`/v1/projects/${slug}/keys`, {}, { headers: { cookie: session.cookie } });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { key: string };
  return body.key;
}

const baseFeedback = {
  pageUrl: "/",
  selector: "#x",
  coordinates: { xPercent: 0.5, yPercent: 0.5, xPx: 100, yPx: 100 },
  viewport: { width: 1024, height: 768, devicePixelRatio: 1 },
};

describe("auth", () => {
  it("signup -> login -> me round-trip", async () => {
    const { cookie } = await signup("bob@example.com", "supersafepw");

    // Subsequent /v1/auth/me with the cookie returns the same user.
    const me = await app.fetch(new Request("http://test.local/v1/auth/me", { headers: { cookie } }));
    expect(me.status).toBe(200);
    const body = (await me.json()) as { user: { email: string } };
    expect(body.user.email).toBe("bob@example.com");
  });

  it("rejects duplicate signup", async () => {
    await signup("dup@example.com");
    const dup = await postJson("/v1/auth/signup", {
      email: "dup@example.com",
      password: "anotherpw",
      name: "dup",
    });
    expect(dup.status).toBe(409);
  });

  it("rejects /v1/projects without a session", async () => {
    const res = await app.fetch(new Request("http://test.local/v1/projects"));
    expect(res.status).toBe(401);
  });
});

describe("projects + keys", () => {
  it("creates and lists projects scoped to the owner", async () => {
    const alice = await signup("alice@example.com");
    await createProject(alice, "alpha");
    const bob = await signup("bob@example.com");
    await createProject(bob, "beta");

    const aliceList = await app.fetch(
      new Request("http://test.local/v1/projects", { headers: { cookie: alice.cookie } })
    );
    const aliceItems = (await aliceList.json()) as { items: { slug: string }[] };
    expect(aliceItems.items.map((p) => p.slug)).toEqual(["alpha"]);

    const bobList = await app.fetch(
      new Request("http://test.local/v1/projects", { headers: { cookie: bob.cookie } })
    );
    const bobItems = (await bobList.json()) as { items: { slug: string }[] };
    expect(bobItems.items.map((p) => p.slug)).toEqual(["beta"]);
  });

  it("rejects duplicate project slug", async () => {
    const session = await signup();
    await createProject(session, "dup");
    const dup = await postJson(
      "/v1/projects",
      { slug: "dup", name: "Dup" },
      { headers: { cookie: session.cookie } }
    );
    expect(dup.status).toBe(409);
  });

  it("returns 404 when reading another owner's project", async () => {
    const alice = await signup("alice@example.com");
    await createProject(alice, "alpha");
    const bob = await signup("bob@example.com");
    const res = await app.fetch(
      new Request("http://test.local/v1/projects/alpha", { headers: { cookie: bob.cookie } })
    );
    expect(res.status).toBe(404);
  });

  it("issues a project API key once and lists its metadata afterward", async () => {
    const session = await signup();
    await createProject(session, "alpha");
    const key = await issueKey(session, "alpha");
    expect(key.length).toBeGreaterThan(20);

    const list = await app.fetch(
      new Request("http://test.local/v1/projects/alpha/keys", { headers: { cookie: session.cookie } })
    );
    const body = (await list.json()) as { items: { prefix: string }[] };
    expect(body.items).toHaveLength(1);
    expect(key.startsWith(body.items[0]!.prefix)).toBe(true);
  });
});

describe("SDK ingest", () => {
  it("rejects ingest without a project key", async () => {
    const res = await postJson("/v1/feedback", baseFeedback);
    expect(res.status).toBe(401);
  });

  it("scopes a created pin to the key's project", async () => {
    const alice = await signup("alice@example.com");
    await createProject(alice, "alpha");
    const aliceKey = await issueKey(alice, "alpha");

    const created = await postJson("/v1/feedback", baseFeedback, {
      headers: { "x-feedback-key": aliceKey },
    });
    expect(created.status).toBe(201);
    const fb = (await created.json()) as { id: string; projectId: string };
    expect(fb.projectId).toBe("alpha");

    // Bob (different user) cannot read the pin via the dashboard.
    const bob = await signup("bob@example.com");
    const otherList = await app.fetch(
      new Request("http://test.local/v1/projects/alpha/feedback", {
        headers: { cookie: bob.cookie },
      })
    );
    expect(otherList.status).toBe(404);
  });

  it("rejects a screenshot upload when the key is for a different project", async () => {
    const session = await signup();
    await createProject(session, "alpha");
    await createProject(session, "beta");
    const alphaKey = await issueKey(session, "alpha");
    const betaKey = await issueKey(session, "beta");

    const created = await postJson("/v1/feedback", baseFeedback, {
      headers: { "x-feedback-key": alphaKey },
    });
    const fb = (await created.json()) as { id: string };

    const png = new Uint8Array([...PNG_HEADER, 0xff, 0xff, 0xff]);
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), "shot.png");
    const res = await app.fetch(
      new Request(`http://test.local/v1/feedback/${fb.id}/screenshot`, {
        method: "POST",
        headers: { "x-feedback-key": betaKey },
        body: form,
      })
    );
    expect(res.status).toBe(403);
  });

  it("uploads, persists, and serves a PNG screenshot", async () => {
    const session = await signup();
    await createProject(session, "alpha");
    const key = await issueKey(session, "alpha");

    const created = await postJson("/v1/feedback", baseFeedback, {
      headers: { "x-feedback-key": key },
    });
    const fb = (await created.json()) as { id: string };

    const png = new Uint8Array([...PNG_HEADER, 0xff, 0xff, 0xff]);
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), "shot.png");
    const upload = await app.fetch(
      new Request(`http://test.local/v1/feedback/${fb.id}/screenshot`, {
        method: "POST",
        headers: { "x-feedback-key": key },
        body: form,
      })
    );
    expect(upload.status).toBe(200);

    const fileBytes = await readFile(path.join(tempDir, "screenshots", `${fb.id}.png`));
    expect(fileBytes.byteLength).toBe(png.byteLength);

    const fetchShot = await app.fetch(
      new Request(`http://test.local/v1/feedback/${fb.id}/screenshot`)
    );
    expect(fetchShot.status).toBe(200);
    expect(fetchShot.headers.get("content-type")).toBe("image/png");
  });
});

describe("dashboard reads", () => {
  it("transitions status via PATCH and the owner sees it in the list", async () => {
    const session = await signup();
    await createProject(session, "alpha");
    const key = await issueKey(session, "alpha");
    const created = await postJson("/v1/feedback", baseFeedback, {
      headers: { "x-feedback-key": key },
    });
    const fb = (await created.json()) as { id: string };

    const patch = await app.fetch(
      new Request(`http://test.local/v1/feedback/${fb.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: session.cookie },
        body: JSON.stringify({ status: "resolved" }),
      })
    );
    expect(patch.status).toBe(200);
    const updated = (await patch.json()) as { status: string };
    expect(updated.status).toBe("resolved");
  });

  it("returns 401 on PATCH without a session", async () => {
    const res = await app.fetch(
      new Request("http://test.local/v1/feedback/nope", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("email notifications", () => {
  interface Captured {
    kind: "new" | "reply";
    feedbackId: string;
  }

  function buildAppWithNotifier(captured: Captured[]) {
    const storage = new LocalDiskDriver({ rootDir: tempDir });
    return createApp({
      env: {
        NODE_ENV: "test",
        PORT: 0,
        STORAGE_DIR: tempDir,
        ALLOWED_ORIGINS: ["*"],
        LOG_LEVEL: "error",
        RATE_LIMIT_INGEST_PER_MIN: 60,
        DATABASE_URL: undefined,
        SESSION_SECRET: "test-secret-32-bytes-long-keep-shh!",
      } as Parameters<typeof createApp>[0]["env"],
      store: createInMemoryStore(),
      storage,
      notifier: {
        notifyNewFeedback: (fb) => captured.push({ kind: "new", feedbackId: fb.id }),
        notifyNewReply: (fb) => captured.push({ kind: "reply", feedbackId: fb.id }),
      },
    });
  }

  it("fires notifyNewFeedback on SDK feedback creation and notifyNewReply on a reply", async () => {
    const captured: Captured[] = [];
    const localApp = buildAppWithNotifier(captured);

    // signup + project + key, all against the local app instance.
    const signupRes = await localApp.fetch(
      new Request("http://test.local/v1/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "owner@example.com", password: "hunter2pw", name: "owner" }),
      })
    );
    const cookie = (signupRes.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

    await localApp.fetch(
      new Request("http://test.local/v1/projects", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ slug: "gamma", name: "gamma" }),
      })
    );
    const keyRes = await localApp.fetch(
      new Request("http://test.local/v1/projects/gamma/keys", {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: "{}",
      })
    );
    const { key } = (await keyRes.json()) as { key: string };

    const created = await localApp.fetch(
      new Request("http://test.local/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json", "x-feedback-key": key },
        body: JSON.stringify({ ...baseFeedback, comment: { author: { name: "Tester" }, body: "hi" } }),
      })
    );
    const fb = (await created.json()) as { id: string };

    expect(captured).toHaveLength(1);
    expect(captured[0]).toEqual({ kind: "new", feedbackId: fb.id });

    // Owner replies via the dashboard session.
    await localApp.fetch(
      new Request(`http://test.local/v1/feedback/${fb.id}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ author: { name: "owner" }, body: "thanks!" }),
      })
    );

    expect(captured).toHaveLength(2);
    expect(captured[1]).toEqual({ kind: "reply", feedbackId: fb.id });
  });
});
