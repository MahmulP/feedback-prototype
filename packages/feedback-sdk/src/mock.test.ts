import { describe, expect, it } from "vitest";
import { createMockTransport } from "./mock.js";

const baseInput = {
  projectId: "demo",
  pageUrl: "/",
  selector: "#x",
  coordinates: { xPercent: 0.5, yPercent: 0.5, xPx: 100, yPx: 100 },
  viewport: { width: 1024, height: 768, devicePixelRatio: 1 },
} as const;

describe("createMockTransport", () => {
  it("creates and lists feedback scoped by project", async () => {
    const t = createMockTransport();
    const a = await t.create({ ...baseInput, projectId: "a" });
    await t.create({ ...baseInput, projectId: "b" });

    const list = await t.list({ projectId: "a" });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]?.id).toBe(a.id);
  });

  it("appends comments to the thread on reply", async () => {
    const t = createMockTransport();
    const fb = await t.create(baseInput);
    const updated = await t.reply(fb.id, { author: { name: "Anita" }, body: "Hi" });
    expect(updated.thread).toHaveLength(1);
    expect(updated.thread[0]?.body).toBe("Hi");
  });

  it("transitions status open -> resolved -> open", async () => {
    const t = createMockTransport();
    const fb = await t.create(baseInput);
    expect(fb.status).toBe("open");
    const resolved = await t.setStatus(fb.id, "resolved");
    expect(resolved.status).toBe("resolved");
    const reopened = await t.setStatus(fb.id, "open");
    expect(reopened.status).toBe("open");
  });

  it("filters by status and pageUrl", async () => {
    const t = createMockTransport();
    const a = await t.create({ ...baseInput, pageUrl: "/checkout" });
    await t.create({ ...baseInput, pageUrl: "/cart" });
    await t.setStatus(a.id, "resolved");

    const open = await t.list({ projectId: "demo", status: "open" });
    expect(open.items).toHaveLength(1);
    expect(open.items[0]?.pageUrl).toBe("/cart");

    const checkout = await t.list({ projectId: "demo", pageUrl: "/checkout" });
    expect(checkout.items).toHaveLength(1);
    expect(checkout.items[0]?.id).toBe(a.id);
  });
});
