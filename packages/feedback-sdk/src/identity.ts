/**
 * Author identity persistence.
 *
 * The SDK needs to know who is leaving a comment. We don't ship an auth
 * system in the SDK itself; instead we cache a `{ name, email? }` blob in
 * `localStorage`, scoped per project, and let consumers override the
 * read/write through `getAuthor` / `setAuthor` options when they have
 * a real auth integration.
 */

import type { FeedbackAuthor } from "./types.js";

const STORAGE_KEY_PREFIX = "mahmulp-fb-author:";

function storageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    // localStorage can throw in privacy-mode contexts
    return null;
  }
}

export function loadAuthor(projectId: string): FeedbackAuthor | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "name" in parsed &&
      typeof (parsed as { name: unknown }).name === "string"
    ) {
      const name = (parsed as { name: string }).name.trim();
      if (name.length === 0) return null;
      const emailValue = (parsed as { email?: unknown }).email;
      const email = typeof emailValue === "string" ? emailValue.trim() : "";
      return email.length > 0 ? { name, email } : { name };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAuthor(projectId: string, author: FeedbackAuthor): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(projectId), JSON.stringify(author));
  } catch {
    // Quota / privacy errors are non-fatal.
  }
}

export function clearAuthor(projectId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(projectId));
  } catch {
    /* ignore */
  }
}
