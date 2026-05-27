"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { api, ApiError } from "@/lib/api";
import { copySetCookieToBrowser } from "@/lib/session-bridge";

const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
});

const signupSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(80),
  next: z.string().max(200).optional(),
});

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function safeNext(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/projects";
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  let res: Response;
  try {
    res = await api.login({ email: parsed.data.email, password: parsed.data.password });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error reaching the API",
    };
  }
  if (!res.ok) {
    if (res.status === 401) return { ok: false, error: "Email or password is incorrect." };
    return { ok: false, error: `Login failed (HTTP ${res.status}).` };
  }
  await copySetCookieToBrowser(res);
  redirect(safeNext(parsed.data.next));
}

export async function signupAction(formData: FormData): Promise<ActionResult> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  let res: Response;
  try {
    res = await api.signup({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error reaching the API",
    };
  }
  if (!res.ok) {
    if (res.status === 409) return { ok: false, error: "Email is already registered." };
    if (res.status === 400) {
      try {
        const data = (await res.json()) as { error?: { message?: string } };
        return { ok: false, error: data?.error?.message ?? "Invalid input." };
      } catch {
        return { ok: false, error: "Invalid input." };
      }
    }
    return { ok: false, error: `Signup failed (HTTP ${res.status}).` };
  }
  await copySetCookieToBrowser(res);
  redirect(safeNext(parsed.data.next));
}
