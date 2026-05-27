import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Local filesystem storage for screenshots.
 *
 * No S3 / R2 / MinIO. The API process reads and writes files itself.
 * This keeps the deployment story trivial: bind one directory and back it
 * up alongside the database.
 */

export interface StorageDriver {
  /** Persist a buffer under `key`. The key is relative to the storage root. */
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Read the bytes for `key`. Returns null when missing. */
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  /** Delete `key`. No-op when missing. */
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface LocalDiskDriverOptions {
  rootDir: string;
}

const ALLOWED_KEY = /^[A-Za-z0-9_./\-]+$/;

/** Reject any key that could escape the storage root. */
function assertKeySafe(key: string): void {
  if (!key || key.length > 256) throw new Error("storage: invalid key length");
  if (!ALLOWED_KEY.test(key)) throw new Error("storage: invalid characters in key");
  if (key.includes("..")) throw new Error("storage: '..' segment not allowed");
  if (key.startsWith("/") || key.startsWith("\\")) throw new Error("storage: absolute key not allowed");
}

export class LocalDiskDriver implements StorageDriver {
  private rootDir: string;
  // We map content-type alongside the file so reads don't have to re-detect.
  private metaSuffix = ".ct";

  constructor(opts: LocalDiskDriverOptions) {
    this.rootDir = path.resolve(opts.rootDir);
  }

  async ensureRoot(): Promise<void> {
    if (!existsSync(this.rootDir)) {
      await mkdir(this.rootDir, { recursive: true });
    }
  }

  private resolvePath(key: string): string {
    assertKeySafe(key);
    const resolved = path.resolve(this.rootDir, key);
    if (!resolved.startsWith(this.rootDir + path.sep) && resolved !== this.rootDir) {
      throw new Error("storage: resolved path escapes root");
    }
    return resolved;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, body);
    await writeFile(filePath + this.metaSuffix, contentType, "utf8");
  }

  async get(key: string): Promise<{ body: Uint8Array; contentType: string } | null> {
    const filePath = this.resolvePath(key);
    try {
      const [body, ct] = await Promise.all([
        readFile(filePath),
        readFile(filePath + this.metaSuffix, "utf8").catch(() => "application/octet-stream"),
      ]);
      return { body: new Uint8Array(body), contentType: (ct as string).trim() || "application/octet-stream" };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolvePath(key);
    await Promise.all([
      unlink(filePath).catch((err) => {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }),
      unlink(filePath + this.metaSuffix).catch((err) => {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }),
    ]);
  }

  async exists(key: string): Promise<boolean> {
    const filePath = this.resolvePath(key);
    try {
      await stat(filePath);
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw err;
    }
  }
}

/**
 * Verify a buffer's magic bytes match an allowed image type, and return the
 * canonical content-type. Returns null when the buffer is not an allowed image.
 */
export function detectImageMime(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  // WebP: 'RIFF' .... 'WEBP'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}
