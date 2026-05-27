import { afterEach, describe, expect, it } from "vitest";
import { _resetEnvForTests, loadEnv } from "./env.js";

afterEach(() => {
  _resetEnvForTests();
});

describe("loadEnv", () => {
  it("applies defaults for unspecified values", () => {
    const env = loadEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(8787);
    expect(env.STORAGE_DIR).toBe("./data/screenshots");
    expect(env.ALLOWED_ORIGINS).toEqual(["*"]);
  });

  it("parses ALLOWED_ORIGINS as a list", () => {
    const env = loadEnv({
      ALLOWED_ORIGINS: "http://a.example, http://b.example, ",
    } as NodeJS.ProcessEnv);
    expect(env.ALLOWED_ORIGINS).toEqual(["http://a.example", "http://b.example"]);
  });

  it("rejects invalid PORT values", () => {
    expect(() => loadEnv({ PORT: "not-a-number" } as NodeJS.ProcessEnv)).toThrow();
  });
});
