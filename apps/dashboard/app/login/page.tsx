import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { publicEnv } from "@/lib/env";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ next?: string; mode?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next, mode } = await searchParams;
  const me = await api.me();
  if (me) {
    redirect(next && next.startsWith("/") ? next : "/projects");
  }
  const env = publicEnv();
  const initialMode = mode === "signup" ? "signup" : "login";

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{initialMode === "signup" ? "Create account" : `Sign in to ${env.NEXT_PUBLIC_APP_NAME}`}</CardTitle>
          <CardDescription>
            {initialMode === "signup"
              ? "We'll create your dashboard account and sign you in immediately."
              : "Use the email + password you registered with."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} mode={initialMode} />
        </CardContent>
      </Card>
    </div>
  );
}
