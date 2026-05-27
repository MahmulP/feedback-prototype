"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginAction, signupAction } from "./actions";

type Mode = "login" | "signup";

export function LoginForm({ next, mode: initialMode = "login" }: { next?: string; mode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const action = mode === "login" ? loginAction : signupAction;
        const res = await action(formData);
        if (!res.ok) toast.error(res.error ?? `${mode} failed`);
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) throw err;
        toast.error(err instanceof Error ? err.message : `${mode} failed`);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {mode === "signup" ? (
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-xs font-medium text-muted-foreground">
            Your name
          </label>
          <Input id="name" name="name" required autoComplete="name" placeholder="Anita" />
        </div>
      ) : null}
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
          Password {mode === "signup" ? <span className="opacity-60">(min 8 chars)</span> : null}
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 8 : 1}
          placeholder="••••••••"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Sign in" : "Create account"}
      </Button>
      <button
        type="button"
        className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
      >
        {mode === "login" ? "No account? Sign up" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}
