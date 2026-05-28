import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const html2canvasMock = vi.hoisted(() =>
  vi.fn(async () => {
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

  it("hides the SDK overlay host during capture and restores it after", async () => {
    const host = document.createElement("div");
    host.setAttribute("data-mahmulp-feedback-host", "");
    document.body.appendChild(host);

    let visibilityDuringCapture: string | null = null;
    html2canvasMock.mockImplementationOnce(async () => {
      visibilityDuringCapture = host.style.visibility;
      const canvas = document.createElement("canvas");
      canvas.width = 4;
      canvas.height = 4;
      return canvas;
    });

    await captureViewport();
    expect(visibilityDuringCapture).toBe("hidden");
    expect(host.style.visibility).toBe(""); // restored to the initial empty value
  });

  it("returns null when html2canvas throws instead of bubbling the error", async () => {
    html2canvasMock.mockRejectedValueOnce(new Error("nope"));
    const blob = await captureViewport();
    expect(blob).toBeNull();
  });
});
