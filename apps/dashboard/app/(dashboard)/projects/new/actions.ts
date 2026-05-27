"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";

const slugRegex = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

const schema = z.object({
  slug: z.string().trim().regex(slugRegex, "lowercase letters, digits, dashes — 1–64 chars"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
});

export interface CreateProjectResult {
  ok: boolean;
  error?: string;
}

export async function createProjectAction(formData: FormData): Promise<CreateProjectResult> {
  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const project = await api.createProject(parsed.data);
    revalidatePath("/projects");
    redirect(`/projects/${encodeURIComponent(project.slug)}/keys?just_created=1`);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409) return { ok: false, error: "That slug is already taken." };
      if (err.status === 401) return { ok: false, error: "Your session expired. Sign in again." };
      return { ok: false, error: err.message };
    }
    throw err;
  }
}
