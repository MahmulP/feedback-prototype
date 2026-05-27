import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authConfigured, getSession } from "@/lib/session";
import { publicEnv } from "@/lib/env";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  const session = await getSession();
  if (session) {
    redirect(next && next.startsWith("/") ? next : "/projects");
  }
  const env = publicEnv();
  const configured = authConfigured();

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to {env.NEXT_PUBLIC_APP_NAME}</CardTitle>
          <CardDescription>
            Use the admin credentials configured in the dashboard environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!configured ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Auth not configured</p>
                <p className="text-muted-foreground">
                  Set <code className="font-mono">ADMIN_EMAIL</code> and{" "}
                  <code className="font-mono">ADMIN_PASSWORD</code> (or{" "}
                  <code className="font-mono">ADMIN_PASSWORD_HASH</code>) in the dashboard env, then restart.
                </p>
              </div>
            </div>
          ) : null}
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </div>
  );
}
