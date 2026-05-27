import "server-only";
import { cookies } from "next/headers";

/**
 * Mirror the API's `mahmulp_session` cookie onto the Next.js response so the
 * browser stores it for the dashboard origin. Called from server actions
 * after `api.signup` / `api.login` / `api.logout`.
 */
export async function copySetCookieToBrowser(res: Response): Promise<void> {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return;

  // Parse "name=value; Path=/; HttpOnly; SameSite=Lax; Max-Age=N"
  const firstSemi = setCookie.indexOf(";");
  const head = firstSemi >= 0 ? setCookie.slice(0, firstSemi) : setCookie;
  const eq = head.indexOf("=");
  if (eq < 0) return;
  const name = head.slice(0, eq).trim();
  const value = head.slice(eq + 1);

  const attrs = new Map<string, string>();
  if (firstSemi >= 0) {
    for (const part of setCookie.slice(firstSemi + 1).split(";")) {
      const [k, v = ""] = part.split("=");
      attrs.set(k.trim().toLowerCase(), v.trim());
    }
  }
  const maxAge = attrs.has("max-age") ? Number(attrs.get("max-age")) : undefined;
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: attrs.get("path") ?? "/",
    ...(typeof maxAge === "number" && Number.isFinite(maxAge) ? { maxAge } : {}),
  });
}
