"use client";

import { useState, useTransition } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteKeyAction, issueKeyAction } from "./actions";

interface Props {
  slug: string;
  apiUrl: string;
  keys: { id: string; prefix: string; createdAt: string; lastUsedAt?: string }[];
}

export function KeysControls({ slug, apiUrl, keys }: Props) {
  const [pending, startTransition] = useTransition();
  const [latestKey, setLatestKey] = useState<string | null>(null);

  function onIssue() {
    startTransition(async () => {
      const res = await issueKeyAction(slug);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to create key");
        return;
      }
      setLatestKey(res.key ?? null);
      toast.success("New API key created. Copy it now — you won't see it again.");
    });
  }

  function onDelete(id: string) {
    if (!window.confirm("Revoke this key? Any prototype using it will stop syncing.")) return;
    startTransition(async () => {
      const res = await deleteKeyAction(slug, id);
      if (!res.ok) {
        toast.error(res.error ?? "Failed to revoke");
      } else {
        toast.success("Key revoked.");
      }
    });
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard."),
      () => toast.error("Copy failed.")
    );
  }

  const snippet = latestKey
    ? `import { initFeedback } from '@mahmulp/feedback-sdk'

initFeedback({
  apiUrl: '${apiUrl}',
  apiKey: '${latestKey}',
})`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={onIssue} disabled={pending}>
          <KeyRound className="size-4" aria-hidden /> Generate new key
        </Button>
      </div>

      {latestKey ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold">New key — shown only once</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Copy it now. We only store a hash, so it can't be retrieved later.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-md bg-background p-2 font-mono text-xs">
            <span className="flex-1 truncate">{latestKey}</span>
            <Button variant="ghost" size="sm" onClick={() => copy(latestKey)}>
              <Copy className="size-4" aria-hidden /> Copy
            </Button>
          </div>
          {snippet ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Show install snippet
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{snippet}</pre>
            </details>
          ) : null}
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setLatestKey(null)}>
            I copied it
          </Button>
        </div>
      ) : null}

      {keys.length === 0 ? (
        <p className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
          No keys yet. Create one above so your prototype can start sending feedback.
        </p>
      ) : (
        <ul className="divide-y rounded-md border bg-card">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-mono text-xs">{k.prefix}…</p>
                <p className="text-xs text-muted-foreground">
                  Created {new Date(k.createdAt).toLocaleString()}
                  {k.lastUsedAt ? ` · Last used ${new Date(k.lastUsedAt).toLocaleString()}` : " · Never used"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => onDelete(k.id)}
              >
                <Trash2 className="size-4" aria-hidden /> Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
