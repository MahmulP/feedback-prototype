"use server";

import { redirect } from "next/navigation";

import { api } from "@/lib/api";
import { copySetCookieToBrowser } from "@/lib/session-bridge";

export async function logoutAction(): Promise<void> {
  try {
    const res = await api.logout();
    await copySetCookieToBrowser(res);
  } catch {
    /* still clear locally */
  }
  redirect("/login");
}
