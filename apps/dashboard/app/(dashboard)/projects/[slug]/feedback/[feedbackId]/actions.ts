"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api } from "@/lib/api";

const statusSchema = z.enum(["open", "resolved", "archived"]);

const replySchema = z.object({
  authorName: z.string().trim().min(1).max(80),
  authorEmail: z.string().email().max(200).optional().or(z.literal("")),
  body: z.string().trim().min(1).max(4000),
});

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function updateStatusAction(
  slug: string,
  feedbackId: string,
  rawStatus: string
): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(rawStatus);
  if (!parsed.success) return { ok: false, error: "Invalid status" };
  try {
    await api.setStatus(feedbackId, parsed.data);
    revalidatePath(`/projects/${encodeURIComponent(slug)}`);
    revalidatePath(`/projects/${encodeURIComponent(slug)}/feedback/${encodeURIComponent(feedbackId)}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
  }
}

export async function replyAction(
  slug: string,
  feedbackId: string,
  formData: FormData
): Promise<ActionResult> {
  const parsed = replySchema.safeParse({
    authorName: formData.get("authorName"),
    authorEmail: formData.get("authorEmail") || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const email = parsed.data.authorEmail && parsed.data.authorEmail.length > 0
      ? parsed.data.authorEmail
      : undefined;
    await api.reply(feedbackId, {
      author: { name: parsed.data.authorName, ...(email ? { email } : {}) },
      body: parsed.data.body,
    });
    revalidatePath(`/projects/${encodeURIComponent(slug)}/feedback/${encodeURIComponent(feedbackId)}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Request failed" };
  }
}
