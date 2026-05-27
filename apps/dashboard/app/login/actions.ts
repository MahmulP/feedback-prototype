"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { setSession, verifyCredentials, authConfigured } from "@/lib/session";

const schema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
  next: z.string().max(200).optional(),
});

export interface LoginResult {
  ok: boolean;
  error?: string;
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
  if (!authConfigured()) {
    return {
      ok: false,
      error:
        "Auth is not configured. Set ADMIN_EMAIL + ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH) in the dashboard environment.",
    };
  }
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!verifyCredentials(parsed.data.email, parsed.data.password)) {
    return { ok: false, error: "Email or password is incorrect." };
  }
  await setSession(parsed.data.email);
  const dest = isSafeRedirect(parsed.data.next) ? parsed.data.next : "/projects";
  redirect(dest);
}

function isSafeRedirect(value: string | undefined): value is string {
  if (!value) return false;
  return value.startsWith("/") && !value.startsWith("//");
}
