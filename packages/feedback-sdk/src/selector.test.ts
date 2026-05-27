import { afterEach, describe, expect, it } from "vitest";
import { findElement, resolveSelector } from "./selector.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("resolveSelector", () => {
  it("uses data-feedback-id when present on the element", () => {
    const btn = document.createElement("button");
    btn.setAttribute("data-feedback-id", "submit-btn");
    document.body.appendChild(btn);
    expect(resolveSelector(btn)).toBe('[data-feedback-id="submit-btn"]');
  });

  it("uses data-feedback-id when present on an ancestor", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-feedback-id", "card");
    const inner = document.createElement("span");
    wrapper.appendChild(inner);
    document.body.appendChild(wrapper);
    expect(resolveSelector(inner)).toBe('[data-feedback-id="card"]');
  });

  it("uses a stable id when there is no data-feedback-id", () => {
    const el = document.createElement("section");
    el.id = "checkout";
    document.body.appendChild(el);
    expect(resolveSelector(el)).toBe("#checkout");
  });

  it("rejects auto-generated id-looking strings and falls back to structural", () => {
    const el = document.createElement("div");
    el.id = "abc1234567def"; // long hex run -> not stable
    document.body.appendChild(el);
    const sel = resolveSelector(el);
    expect(sel).not.toBe(`#${el.id}`);
    expect(sel.length).toBeGreaterThan(0);
  });

  it("produces a structural selector that re-resolves to the same element", () => {
    const a = document.createElement("div");
    const b = document.createElement("div");
    const c = document.createElement("p");
    const d = document.createElement("p");
    a.appendChild(b);
    b.appendChild(c);
    b.appendChild(d);
    document.body.appendChild(a);

    const sel = resolveSelector(d);
    expect(findElement(sel)).toBe(d);
  });

  it("ignores data-feedback-id values that are not safe slugs and falls back to structural", () => {
    const el = document.createElement("button");
    el.setAttribute("data-feedback-id", 'weird"name with spaces');
    document.body.appendChild(el);
    const sel = resolveSelector(el);
    expect(sel.startsWith("[data-feedback-id")).toBe(false);
    // The structural fallback must still re-resolve back to this element.
    expect(findElement(sel)).toBe(el);
  });
});

describe("findElement", () => {
  it("returns null for malformed selectors instead of throwing", () => {
    expect(findElement(":::not-a-selector")).toBeNull();
  });

  it("returns null for missing elements", () => {
    expect(findElement("#does-not-exist")).toBeNull();
  });
});
