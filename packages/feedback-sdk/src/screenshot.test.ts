import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Html2CanvasMock = (
  root?: Element | HTMLElement,
  options?: Record<string, unknown>
) => Promise<HTMLCanvasElement>;

const html2canvasMock = vi.hoisted(() =>
  vi.fn<Html2CanvasMock>(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    return canvas;
  })
);

vi.mock("html2canvas-pro", () => ({ default: html2canvasMock }));

import { _resetForTests, captureViewport } from "./screenshot.js";

beforeEach(() => {
  document.body.innerHTML = "";
  html2canvasMock.mockClear();
  _resetForTests();
});

afterEach(() => {
  _resetForTests();
});

describe("captureViewport", () => {
  it("invokes html2canvas via dynamic import and returns a Blob", async () => {
    const blob = await captureViewport();
    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    expect(blob).toBeInstanceOf(Blob);
  });

  it("excludes the SDK overlay host via ignoreElements without toggling visibility", async () => {
    const host = document.createElement("div");
    host.setAttribute("data-mahmulp-feedback-host", "");
    const child = document.createElement("span");
    host.appendChild(child);
    document.body.appendChild(host);

    let visibilityDuringCapture: string | null = null;
    let ignoreFn: ((el: Element) => boolean) | null = null;
    html2canvasMock.mockImplementationOnce(async (_root, options = {}) => {
      visibilityDuringCapture = host.style.visibility;
      ignoreFn = options.ignoreElements as (el: Element) => boolean;
      const canvas = document.createElement("canvas");
      canvas.width = 4;
      canvas.height = 4;
      return canvas;
    });

    await captureViewport();
    // No more visibility:hidden trick — that's the source of the visible
    // "composer/launcher blinks during capture" glitch.
    expect(visibilityDuringCapture).toBe("");
    expect(host.style.visibility).toBe("");
    // The host itself and its descendants must be skipped during capture.
    expect(ignoreFn).toBeTypeOf("function");
    expect(ignoreFn!(host)).toBe(true);
    expect(ignoreFn!(child)).toBe(true);
    expect(ignoreFn!(document.body)).toBe(false);
  });

  it("returns null when html2canvas throws instead of bubbling the error", async () => {
    html2canvasMock.mockRejectedValueOnce(new Error("nope"));
    const blob = await captureViewport();
    expect(blob).toBeNull();
  });
});
