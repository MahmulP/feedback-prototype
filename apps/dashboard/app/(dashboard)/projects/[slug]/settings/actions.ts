"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
  allowedOrigins: z.string().optional(),
});

function parseOrigins(value: string | undefined): string[] | undefined {
  if (!value) return [];
  const list = value
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return list;
}

export interface UpdateProjectResult {
  ok: boolean;
  error?: string;
}

export async function updateProjectAction(slug: string, formData: FormData): Promise<UpdateProjectResult> {
  const parsed = updateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    allowedOrigins: formData.get("allowedOrigins") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await api.updateProject(slug, {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.allowedOrigins !== undefined
        ? { allowedOrigins: parseOrigins(parsed.data.allowedOrigins) ?? [] }
        : {}),
    });
    revalidatePath(`/projects/${encodeURIComponent(slug)}`);
    revalidatePath(`/projects/${encodeURIComponent(slug)}/settings`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function deleteProjectAction(slug: string): Promise<UpdateProjectResult> {
  try {
    await api.deleteProject(slug);
    revalidatePath("/projects");
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
  redirect("/projects");
}
