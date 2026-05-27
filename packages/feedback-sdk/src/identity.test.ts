import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAuthor, loadAuthor, saveAuthor } from "./identity.js";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("identity persistence", () => {
  it("returns null when nothing has been saved", () => {
    expect(loadAuthor("p1")).toBeNull();
  });

  it("round-trips name + email", () => {
    saveAuthor("p1", { name: "Anita", email: "a@example.com" });
    expect(loadAuthor("p1")).toEqual({ name: "Anita", email: "a@example.com" });
  });

  it("preserves a missing email field instead of inventing one", () => {
    saveAuthor("p1", { name: "Anita" });
    expect(loadAuthor("p1")).toEqual({ name: "Anita" });
  });

  it("scopes records per project", () => {
    saveAuthor("p1", { name: "Anita" });
    saveAuthor("p2", { name: "Budi" });
    expect(loadAuthor("p1")?.name).toBe("Anita");
    expect(loadAuthor("p2")?.name).toBe("Budi");
  });

  it("returns null for malformed JSON instead of throwing", () => {
    localStorage.setItem("mahmulp-fb-author:p1", "{not json");
    expect(loadAuthor("p1")).toBeNull();
  });

  it("treats blank names as missing", () => {
    saveAuthor("p1", { name: "   " });
    expect(loadAuthor("p1")).toBeNull();
  });

  it("clears an existing record", () => {
    saveAuthor("p1", { name: "Anita" });
    clearAuthor("p1");
    expect(loadAuthor("p1")).toBeNull();
  });
});
