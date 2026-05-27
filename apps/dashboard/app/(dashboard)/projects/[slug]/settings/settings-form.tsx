"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteProjectAction, updateProjectAction } from "./actions";

interface Props {
  slug: string;
  initial: {
    name: string;
    description?: string;
    allowedOrigins: string[];
  };
}

export function SettingsForm({ slug, initial }: Props) {
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const res = await updateProjectAction(slug, formData);
        if (!res.ok) toast.error(res.error ?? "Failed to update");
        else toast.success("Project updated.");
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) throw err;
        toast.error(err instanceof Error ? err.message : "Failed to update");
      }
    });
  }

  function onDelete() {
    if (!window.confirm(`Delete project "${initial.name}"? This removes every pin and key.`)) return;
    startTransition(async () => {
      try {
        const res = await deleteProjectAction(slug);
        if (!res.ok) toast.error(res.error ?? "Failed to delete");
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) throw err;
        toast.error(err instanceof Error ? err.message : "Failed to delete");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form action={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-xs font-medium text-muted-foreground">Name</label>
          <Input id="name" name="name" defaultValue={initial.name} maxLength={120} required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="description" className="text-xs font-medium text-muted-foreground">
            Description
          </label>
          <Textarea
            id="description"
            name="description"
            defaultValue={initial.description ?? ""}
            maxLength={1000}
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="allowedOrigins" className="text-xs font-medium text-muted-foreground">
            Allowed origins <span className="opacity-60">(one per line, optional)</span>
          </label>
          <Textarea
            id="allowedOrigins"
            name="allowedOrigins"
            defaultValue={initial.allowedOrigins.join("\n")}
            placeholder={"https://prototype.example.com\nhttps://staging.example.com"}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Used to lock down which sites can call the SDK with this project's keys. Leave empty to allow any origin.
          </p>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </form>

      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Deleting the project also removes all feedback pins and API keys. There's no undo.
        </p>
        <Button variant="destructive" size="sm" className="mt-3" disabled={pending} onClick={onDelete}>
          Delete project
        </Button>
      </div>
    </div>
  );
}
