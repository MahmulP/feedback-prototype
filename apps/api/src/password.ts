import crypto from "node:crypto";

/**
 * Password hashing.
 *
 * Preferred path: Bun's built-in Argon2id (`Bun.password.hash` / `verify`).
 * Bun is the production runtime, so deployments get Argon2 with no native
 * dependency.
 *
 * Fallback: PBKDF2-SHA512 (200_000 iters), pure Node `crypto`. Used when the
 * code runs under plain Node (vitest test runner, scripts, etc.). The on-disk
 * format is prefixed with the algorithm so verification dispatches correctly.
 */

interface BunPassword {
  hash(input: string, options?: { algorithm?: "argon2id" }): Promise<string>;
  verify(input: string, hash: string): Promise<boolean>;
}

function bunPassword(): BunPassword | null {
  const g = globalThis as unknown as { Bun?: { password?: BunPassword } };
  return g.Bun?.password ?? null;
}

const PBKDF2_ITERS = 200_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";

function pbkdf2Hash(plain: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.pbkdf2(plain, salt, PBKDF2_ITERS, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, derived) => {
      if (err) return reject(err);
      resolve(`pbkdf2$${PBKDF2_ITERS}$${salt.toString("base64url")}$${derived.toString("base64url")}`);
    });
  });
}

function pbkdf2Verify(plain: string, hash: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parts = hash.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2") return resolve(false);
    const iters = Number(parts[1]);
    const salt = Buffer.from(parts[2]!, "base64url");
    const expected = Buffer.from(parts[3]!, "base64url");
    crypto.pbkdf2(plain, salt, iters, expected.length, PBKDF2_DIGEST, (err, derived) => {
      if (err) return resolve(false);
      try {
        resolve(crypto.timingSafeEqual(derived, expected));
      } catch {
        resolve(false);
      }
    });
  });
}

export async function hashPassword(plain: string): Promise<string> {
  const bun = bunPassword();
  if (bun) return bun.hash(plain, { algorithm: "argon2id" });
  return pbkdf2Hash(plain);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (hash.startsWith("pbkdf2$")) return pbkdf2Verify(plain, hash);
  const bun = bunPassword();
  if (bun) {
    try {
      return await bun.verify(plain, hash);
    } catch {
      return false;
    }
  }
  return false;
}
