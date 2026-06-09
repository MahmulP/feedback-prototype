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

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["editor", "viewer"]).default("viewer"),
});

export interface MemberResult {
  ok: boolean;
  error?: string;
}

export async function addMemberAction(slug: string, formData: FormData): Promise<MemberResult> {
  const parsed = addMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") ?? "viewer",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await api.addProjectMember(slug, parsed.data);
    revalidatePath(`/projects/${encodeURIComponent(slug)}/settings`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === "user_not_found") {
        return { ok: false, error: "No registered user with that email. They need an account first." };
      }
      if (err.code === "already_member") return { ok: false, error: "That user already has access." };
      if (err.code === "cannot_add_owner") return { ok: false, error: "You already own this project." };
      return { ok: false, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function removeMemberAction(slug: string, memberId: string): Promise<MemberResult> {
  try {
    await api.removeProjectMember(slug, memberId);
    revalidatePath(`/projects/${encodeURIComponent(slug)}/settings`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

const shareLinkSchema = z.object({
  label: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
  expiresInDays: z.coerce.number().int().positive().max(365).optional(),
});

export interface CreateShareLinkResult {
  ok: boolean;
  token?: string;
  url?: string;
  error?: string;
}

export async function createShareLinkAction(
  slug: string,
  formData: FormData
): Promise<CreateShareLinkResult> {
  const rawDays = formData.get("expiresInDays");
  const parsed = shareLinkSchema.safeParse({
    label: formData.get("label") ?? undefined,
    expiresInDays: rawDays === null || rawDays === "" ? undefined : rawDays,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const issued = await api.createShareLink(slug, {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.expiresInDays !== undefined ? { expiresInDays: parsed.data.expiresInDays } : {}),
    });
    revalidatePath(`/projects/${encodeURIComponent(slug)}/settings`);
    return { ok: true, token: issued.token, ...(issued.url ? { url: issued.url } : {}) };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}

export async function deleteShareLinkAction(slug: string, linkId: string): Promise<MemberResult> {
  try {
    await api.deleteShareLink(slug, linkId);
    revalidatePath(`/projects/${encodeURIComponent(slug)}/settings`);
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: err instanceof Error ? err.message : "Failed" };
  }
}
