import { redirect } from "next/navigation";

import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await api.me();
  redirect(me ? "/projects" : "/login");
}
