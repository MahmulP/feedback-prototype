import { afterEach, describe, expect, it, vi } from "vitest";
import { computeCoordinates, projectCoordinates } from "./coordinates.js";

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

function fakeRect(target: Element, rect: Partial<DOMRect>) {
  vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
    x: rect.left ?? 0,
    y: rect.top ?? 0,
    left: rect.left ?? 0,
    top: rect.top ?? 0,
    right: (rect.left ?? 0) + (rect.width ?? 0),
    bottom: (rect.top ?? 0) + (rect.height ?? 0),
    width: rect.width ?? 0,
    height: rect.height ?? 0,
    toJSON() {
      return this;
    },
  } as DOMRect);
}

describe("computeCoordinates", () => {
  it("computes percentages relative to the bounding box and absolute page pixels", () => {
    const el = document.createElement("button");
    document.body.appendChild(el);
    fakeRect(el, { left: 100, top: 50, width: 200, height: 100 });
    Object.defineProperty(window, "scrollX", { value: 10, configurable: true });
    Object.defineProperty(window, "scrollY", { value: 20, configurable: true });

    const c = computeCoordinates(el, 200, 100); // middle of the element
    expect(c.xPercent).toBeCloseTo(0.5, 5);
    expect(c.yPercent).toBeCloseTo(0.5, 5);
    expect(c.xPx).toBe(210);
    expect(c.yPx).toBe(120);
  });

  it("clamps percentages to the [0, 1] range", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    fakeRect(el, { left: 0, top: 0, width: 100, height: 100 });

    const above = computeCoordinates(el, -50, -50);
    expect(above.xPercent).toBe(0);
    expect(above.yPercent).toBe(0);

    const below = computeCoordinates(el, 500, 500);
    expect(below.xPercent).toBe(1);
    expect(below.yPercent).toBe(1);
  });

  it("survives a zero-sized bounding box without producing NaN", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    fakeRect(el, { left: 0, top: 0, width: 0, height: 0 });

    const c = computeCoordinates(el, 0, 0);
    expect(Number.isFinite(c.xPercent)).toBe(true);
    expect(Number.isFinite(c.yPercent)).toBe(true);
  });
});

describe("projectCoordinates", () => {
  it("falls back to absolute pixels when target is null (orphaned)", () => {
    const result = projectCoordinates(null, {
      xPercent: 0.5,
      yPercent: 0.5,
      xPx: 123,
      yPx: 456,
    });
    expect(result).toEqual({ x: 123, y: 456, orphaned: true });
  });

  it("projects onto the target's current bounding box when present", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    fakeRect(el, { left: 200, top: 100, width: 400, height: 200 });
    Object.defineProperty(window, "scrollX", { value: 0, configurable: true });
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });

    const result = projectCoordinates(el, {
      xPercent: 0.25,
      yPercent: 0.5,
      xPx: 0,
      yPx: 0,
    });
    expect(result.orphaned).toBe(false);
    expect(result.x).toBeCloseTo(300, 5);
    expect(result.y).toBeCloseTo(200, 5);
  });
});
