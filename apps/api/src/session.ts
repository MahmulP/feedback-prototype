import crypto from "node:crypto";
import type { ApiEnv } from "./env.js";

/**
 * Stateless HMAC-signed session cookies for dashboard users.
 *
 * Body is `base64url(JSON({ sub, iat })) . base64url(hmac(secret, body))`.
 * Verifying requires `SESSION_SECRET` to match what was used at sign time, so
 * rotating the secret invalidates every active session — that is intentional.
 */

export const SESSION_COOKIE = "mahmulp_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface Payload {
  sub: string; // user id
  iat: number; // seconds since epoch
}

function getSecret(env: ApiEnv): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (env.NODE_ENV === "production") {
    throw new Error("[api] SESSION_SECRET must be set in production");
  }
  // Dev-only fallback so the app boots before the operator sets one.
  return "dev-only-fallback-32bytes-replace-this-in-production!";
}

export function signSession(env: ApiEnv, userId: string): string {
  const payload: Payload = { sub: userId, iat: Math.floor(Date.now() / 1000) };
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", getSecret(env)).update(json).digest("base64url");
  return `${json}.${mac}`;
}

export function verifySession(env: ApiEnv, token: string | undefined | null): Payload | null {
  if (!token) return null;
  const [json, mac] = token.split(".");
  if (!json || !mac) return null;
  const expected = crypto.createHmac("sha256", getSecret(env)).update(json).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as Payload;
    if (typeof payload.sub !== "string" || typeof payload.iat !== "number") return null;
    if (Date.now() / 1000 - payload.iat > MAX_AGE_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieHeader(env: ApiEnv, token: string): string {
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SECONDS}${secure}`;
}

export function sessionClearHeader(env: ApiEnv): string {
  const secure = env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const parts = header.split(/;\s*/);
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1);
    if (k === name) return v;
  }
  return undefined;
}
