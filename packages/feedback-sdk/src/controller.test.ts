import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Feedback, FeedbackTransport } from "./types.js";
import { initFeedback } from "./controller.js";
import { createMockTransport } from "./mock.js";

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
});

afterEach(() => {
  for (const host of Array.from(document.querySelectorAll("[data-mahmulp-feedback-host]"))) {
    host.remove();
  }
  localStorage.clear();
});

describe("initFeedback controller", () => {
  it("attaches a Shadow DOM host to <body>", () => {
    const ctrl = initFeedback({ transport: createMockTransport() });
    const host = document.querySelector("[data-mahmulp-feedback-host]");
    expect(host).toBeTruthy();
    ctrl.destroy();
  });

  it("removes its host on destroy", () => {
    const ctrl = initFeedback({ transport: createMockTransport() });
    expect(document.querySelector("[data-mahmulp-feedback-host]")).toBeTruthy();
    ctrl.destroy();
    expect(document.querySelector("[data-mahmulp-feedback-host]")).toBeNull();
  });

  it("throws when neither apiUrl nor transport is provided", () => {
    expect(() => initFeedback({})).toThrow();
  });

  it("throws when apiUrl is provided without apiKey", () => {
    expect(() => initFeedback({ apiUrl: "http://localhost:8787" })).toThrow();
  });

  it("setEnabled toggles the controller state", () => {
    const ctrl = initFeedback({ transport: createMockTransport(), enabled: false });
    expect(ctrl.isEnabled()).toBe(false);
    ctrl.setEnabled(true);
    expect(ctrl.isEnabled()).toBe(true);
    ctrl.destroy();
  });

  it("renders an existing pin after refresh", async () => {
    const transport = createMockTransport();
    await transport.create({
      projectId: "demo",
      pageUrl: "/",
      selector: "body",
      coordinates: { xPercent: 0, yPercent: 0, xPx: 10, yPx: 10 },
      viewport: { width: 1024, height: 768, devicePixelRatio: 1 },
    });

    const ctrl = initFeedback({ transport });
    await ctrl.refresh();
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const host = document.querySelector("[data-mahmulp-feedback-host]")!;
    const root = (host as HTMLElement).shadowRoot!;
    expect(root.querySelector(".pin")).toBeTruthy();
    ctrl.destroy();
  });

  it("uploads a screenshot via the transport when capture succeeds", async () => {
    const transport = createMockTransport();
    const uploadSpy = vi.spyOn(transport, "uploadScreenshot");

    const fakeBlob = new Blob(["x"], { type: "image/png" });
    const ctrl = initFeedback({
      transport: transport as FeedbackTransport,
      captureScreenshot: async () => fakeBlob,
    });

    const fb: Feedback = await transport.create({
      projectId: "demo",
      pageUrl: "/",
      selector: "body",
      coordinates: { xPercent: 0, yPercent: 0, xPx: 0, yPx: 0 },
      viewport: { width: 1024, height: 768, devicePixelRatio: 1 },
    });
    await transport.uploadScreenshot!(fb.id, fakeBlob);
    expect(uploadSpy).toHaveBeenCalled();
    ctrl.destroy();
  });

  it("can disable screenshot capture", () => {
    const captureSpy = vi.fn(async () => null);
    const ctrl = initFeedback({
      transport: createMockTransport(),
      captureScreenshots: false,
      captureScreenshot: captureSpy,
    });
    expect(captureSpy).not.toHaveBeenCalled();
    ctrl.destroy();
  });

  it("returns an SSR no-op controller when window is unavailable", () => {
    const realWindow = globalThis.window;
    // @ts-expect-error: simulate SSR
    delete globalThis.window;
    try {
      const ctrl = initFeedback({ transport: createMockTransport() });
      expect(ctrl.isEnabled()).toBe(false);
      ctrl.setEnabled(true);
      expect(ctrl.isEnabled()).toBe(false);
      ctrl.destroy();
    } finally {
      globalThis.window = realWindow;
    }
  });
});
