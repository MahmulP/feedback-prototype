"use client";

import { useRef, useState, useTransition } from "react";
import { Eye, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import type { ProjectMember, SharedRole } from "@mahmulp/shared-types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addMemberAction, removeMemberAction } from "./actions";

interface Props {
  slug: string;
  ownerEmail: string;
  members: ProjectMember[];
}

const ROLE_COPY: Record<SharedRole, { label: string; hint: string }> = {
  editor: { label: "Editor", hint: "Can view and triage feedback (resolve, archive, reply)." },
  viewer: { label: "Viewer", hint: "Read-only — can see feedback but not change it." },
};

export function MembersControls({ slug, ownerEmail, members }: Props) {
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<SharedRole>("viewer");
  const formRef = useRef<HTMLFormElement>(null);

  function onAdd(formData: FormData) {
    startTransition(async () => {
      const res = await addMemberAction(slug, formData);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to share");
        return;
      }
      toast.success("Project shared.");
      formRef.current?.reset();
      setRole("viewer");
    });
  }

  function onRemove(member: ProjectMember) {
    if (!window.confirm(`Remove ${member.email}'s access?`)) return;
    startTransition(async () => {
      const res = await removeMemberAction(slug, member.id);
      if (!res.ok) toast.error(res.error ?? "Failed to remove");
      else toast.success("Access removed.");
    });
  }

  return (
    <section className="space-y-4 rounded-md border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Sharing</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Share this project with other registered users. Editors can triage feedback; viewers
          have read-only access. Only you, the owner, can manage sharing and API keys.
        </p>
      </div>

      <form ref={formRef} action={onAdd} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <label htmlFor="member-email" className="text-xs font-medium text-muted-foreground">
            User email
          </label>
          <Input
            id="member-email"
            name="email"
            type="email"
            placeholder="teammate@example.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="member-role" className="text-xs font-medium text-muted-foreground">
            Role
          </label>
          <select
            id="member-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as SharedRole)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          <UserPlus className="size-4" aria-hidden /> Share
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{ROLE_COPY[role].hint}</p>

      <ul className="divide-y rounded-md border">
        <li className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium">{ownerEmail}</p>
            <p className="text-xs text-muted-foreground">Owner</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            Owner
          </span>
        </li>
        {members.length === 0 ? (
          <li className="px-4 py-3 text-xs italic text-muted-foreground">
            Not shared with anyone yet.
          </li>
        ) : (
          members.map((m) => {
            const RoleIcon = m.role === "editor" ? Pencil : Eye;
            return (
              <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                    <RoleIcon className="size-3" aria-hidden />
                    {m.role}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => onRemove(m)}
                    aria-label={`Remove ${m.email}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
