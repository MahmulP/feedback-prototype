import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";

import { serverEnv } from "./env";

/**
 * Minimal cookie session: HMAC-signed JSON payload, no database.
 *
 * v1 supports a single admin user configured via env (`ADMIN_EMAIL` /
 * `ADMIN_PASSWORD`). We sign with `SESSION_SECRET` so rotating the secret
 * invalidates every active session.
 */

const COOKIE_NAME = "iwk_dash_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface SessionPayload {
  email: string;
  iat: number; // issued-at, seconds since epoch
}

function getSecret(): string {
  const env = serverEnv();
  const secret = env.SESSION_SECRET;
  if (!secret) {
    if (env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production");
    }
    // Dev fallback so login works on first try without populated env.
    return "dev-only-do-not-use-in-production-32bytes!";
  }
  return secret;
}

function sign(payload: SessionPayload): string {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto
    .createHmac("sha256", getSecret())
    .update(json)
    .digest("base64url");
  return `${json}.${mac}`;
}

function verify(token: string): SessionPayload | null {
  const [json, mac] = token.split(".");
  if (!json || !mac) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(json).digest("base64url");
  // timingSafeEqual requires equal-length buffers
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.email !== "string" || typeof payload.iat !== "number") return null;
    const ageSeconds = Math.floor(Date.now() / 1000) - payload.iat;
    if (ageSeconds < 0 || ageSeconds > COOKIE_MAX_AGE_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const cookie = store.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  return verify(cookie.value);
}

export async function setSession(email: string): Promise<void> {
  const token = sign({ email, iat: Math.floor(Date.now() / 1000) });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: serverEnv().NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * Verify supplied credentials against the admin configured via env.
 *
 * For v1 we accept either:
 *   - `ADMIN_EMAIL` + `ADMIN_PASSWORD` (plain), or
 *   - `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (sha256 hex of password)
 *
 * `ADMIN_PASSWORD_HASH` is preferred for any non-local environment. Only one
 * is read; if both are set the hash wins.
 */
export function verifyCredentials(email: string, password: string): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!expectedEmail) return false;
  if (email.trim().toLowerCase() !== expectedEmail) return false;

  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (hash) {
    const candidate = crypto.createHash("sha256").update(password).digest("hex");
    return safeStringEq(candidate, hash);
  }
  const plain = process.env.ADMIN_PASSWORD;
  if (plain) {
    return safeStringEq(password, plain);
  }
  return false;
}

function safeStringEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** True when admin credentials are configured. Used to render install hints. */
export function authConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL?.trim());
}
