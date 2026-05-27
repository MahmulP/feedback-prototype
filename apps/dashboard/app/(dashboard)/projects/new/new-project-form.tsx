"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createProjectAction } from "./actions";

export function NewProjectForm() {
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const res = await createProjectAction(formData);
        if (!res.ok) toast.error(res.error ?? "Failed to create project");
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) throw err;
        toast.error(err instanceof Error ? err.message : "Failed to create project");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-xs font-medium text-muted-foreground">
          Project name
        </label>
        <Input id="name" name="name" required maxLength={120} placeholder="Checkout prototype" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="slug" className="text-xs font-medium text-muted-foreground">
          Slug <span className="opacity-60">(used in the SDK + URLs)</span>
        </label>
        <Input
          id="slug"
          name="slug"
          required
          maxLength={64}
          pattern="^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$"
          placeholder="checkout-v2"
        />
        <p className="text-xs text-muted-foreground">
          Lowercase letters, digits, and dashes. Must be unique across all projects.
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="description" className="text-xs font-medium text-muted-foreground">
          Description <span className="opacity-60">(optional)</span>
        </label>
        <Textarea id="description" name="description" maxLength={1000} rows={3} placeholder="What is this prototype?" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create project"}
      </Button>
    </form>
  );
}
