"use server";

import { revalidatePath } from "next/cache";

import { api, ApiError } from "@/lib/api";

export interface IssueKeyResult {
  ok: boolean;
  key?: string;
  error?: string;
}

export async function issueKeyAction(slug: string): Promise<IssueKeyResult> {
  try {
    const issued = await api.issueProjectKey(slug);
    revalidatePath(`/projects/${encodeURIComponent(slug)}/keys`);
    return { ok: true, key: issued.key };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function deleteKeyAction(slug: string, keyId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.deleteProjectKey(slug, keyId);
    revalidatePath(`/projects/${encodeURIComponent(slug)}/keys`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
