import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectImageMime, LocalDiskDriver } from "./storage.js";

let tempDir: string;
let driver: LocalDiskDriver;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "iwk-fb-storage-"));
  driver = new LocalDiskDriver({ rootDir: tempDir });
  await driver.ensureRoot();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("LocalDiskDriver", () => {
  it("writes, reads, and deletes a file", async () => {
    await driver.put("screenshots/abc.png", new Uint8Array([1, 2, 3]), "image/png");
    expect(await driver.exists("screenshots/abc.png")).toBe(true);
    const blob = await driver.get("screenshots/abc.png");
    expect(blob?.contentType).toBe("image/png");
    expect(blob?.body.byteLength).toBe(3);
    await driver.delete("screenshots/abc.png");
    expect(await driver.exists("screenshots/abc.png")).toBe(false);
  });

  it("returns null when reading a missing key", async () => {
    expect(await driver.get("nope.png")).toBeNull();
    expect(await driver.exists("nope.png")).toBe(false);
  });

  it("rejects path traversal attempts", async () => {
    await expect(driver.put("../escape.png", new Uint8Array([1]), "image/png")).rejects.toThrow();
    await expect(driver.get("../escape.png")).rejects.toThrow();
  });

  it("rejects absolute keys", async () => {
    await expect(driver.put("/etc/passwd", new Uint8Array([1]), "image/png")).rejects.toThrow();
  });

  it("rejects keys with disallowed characters", async () => {
    await expect(driver.put("a b.png", new Uint8Array([1]), "image/png")).rejects.toThrow();
    await expect(driver.put("a*.png", new Uint8Array([1]), "image/png")).rejects.toThrow();
  });
});

describe("detectImageMime", () => {
  it("identifies PNG", () => {
    expect(detectImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png"
    );
  });
  it("identifies JPEG", () => {
    expect(detectImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  });
  it("identifies WebP", () => {
    const bytes = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    expect(detectImageMime(bytes)).toBe("image/webp");
  });
  it("rejects unknown bytes", () => {
    expect(detectImageMime(Uint8Array.from([0x00, 0x01, 0x02, 0x03]))).toBeNull();
  });
});
