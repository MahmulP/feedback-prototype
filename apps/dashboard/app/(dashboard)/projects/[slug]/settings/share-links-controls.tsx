"use client";

import { useState, useTransition } from "react";
import { Copy, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ProjectShareLink } from "@mahmulp/shared-types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createShareLinkAction, deleteShareLinkAction } from "./actions";

interface Props {
  slug: string;
  links: ProjectShareLink[];
}

function shareUrl(token: string): string {
  if (typeof window === "undefined") return `/share/${token}`;
  return `${window.location.origin}/share/${token}`;
}

export function ShareLinksControls({ slug, links }: Props) {
  const [pending, startTransition] = useTransition();
  const [latestUrl, setLatestUrl] = useState<string | null>(null);

  function onCreate(formData: FormData) {
    startTransition(async () => {
      const res = await createShareLinkAction(slug, formData);
      if (!res.ok || !res.token) {
        toast.error(res.error ?? "Failed to create link");
        return;
      }
      // Prefer the server-built URL (from the API's DASHBOARD_URL); fall back
      // to this dashboard's own origin when DASHBOARD_URL isn't configured.
      setLatestUrl(res.url ?? shareUrl(res.token));
      toast.success("Share link created. Copy it now — the token is shown only once.");
    });
  }

  function onDelete(link: ProjectShareLink) {
    if (!window.confirm("Revoke this share link? Anyone using it will lose access immediately.")) return;
    startTransition(async () => {
      const res = await deleteShareLinkAction(slug, link.id);
      if (!res.ok) toast.error(res.error ?? "Failed to revoke");
      else toast.success("Share link revoked.");
    });
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard."),
      () => toast.error("Copy failed.")
    );
  }

  return (
    <section className="space-y-4 rounded-md border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">Public share links</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Generate a read-only link so people who left feedback can view it without an account.
          Anyone with the link can see this project's feedback until you revoke it. Keep it private.
        </p>
      </div>

      <form action={onCreate} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1 space-y-1.5">
          <label htmlFor="link-label" className="text-xs font-medium text-muted-foreground">
            Label <span className="opacity-60">(optional)</span>
          </label>
          <Input id="link-label" name="label" placeholder="e.g. Client review" maxLength={80} />
        </div>
        <div className="w-32 space-y-1.5">
          <label htmlFor="link-expiry" className="text-xs font-medium text-muted-foreground">
            Expires (days)
          </label>
          <Input id="link-expiry" name="expiresInDays" type="number" min={1} max={365} placeholder="never" />
        </div>
        <Button type="submit" disabled={pending}>
          <Link2 className="size-4" aria-hidden /> Create link
        </Button>
      </form>

      {latestUrl ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold">New share link</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Copy it now. The token can't be retrieved later — generate a new link if you lose it.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-md bg-background p-2 font-mono text-xs">
            <span className="flex-1 truncate">{latestUrl}</span>
            <Button variant="ghost" size="sm" onClick={() => copy(latestUrl)}>
              <Copy className="size-4" aria-hidden /> Copy
            </Button>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => setLatestUrl(null)}>
            I copied it
          </Button>
        </div>
      ) : null}

      {links.length === 0 ? (
        <p className="rounded-md border bg-background p-4 text-center text-xs text-muted-foreground">
          No share links yet.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {links.map((link) => {
            const expired = link.expiresAt ? Date.parse(link.expiresAt) <= Date.now() : false;
            return (
              <li key={link.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {link.label ?? "Untitled link"}{" "}
                    <span className="font-mono text-xs text-muted-foreground">{link.prefix}…</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(link.createdAt).toLocaleDateString()}
                    {link.expiresAt
                      ? expired
                        ? " · expired"
                        : ` · expires ${new Date(link.expiresAt).toLocaleDateString()}`
                      : " · no expiry"}
                    {link.lastUsedAt ? ` · last used ${new Date(link.lastUsedAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => onDelete(link)}
                  aria-label="Revoke link"
                >
                  <Trash2 className="size-4" aria-hidden /> Revoke
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
