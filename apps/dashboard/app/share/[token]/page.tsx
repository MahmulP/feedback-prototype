import { ImageOff, Link2Off } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: PageProps) {
  const { token } = await params;
  const project = await api.share.project(token);

  if (!project) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <Link2Off className="size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold">This share link isn&apos;t valid</h1>
        <p className="text-sm text-muted-foreground">
          The link may have been revoked or expired. Ask whoever shared it for a fresh link.
        </p>
      </main>
    );
  }

  const { items } = await api.share.listFeedback(token);
  const appName = publicEnv().NEXT_PUBLIC_APP_NAME;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8 border-b pb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{appName} · Shared view</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{project.name}</h1>
        {project.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">
          Read-only view of {items.length} feedback {items.length === 1 ? "item" : "items"}. You&apos;re
          viewing a shared link — no account needed.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          No feedback yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((fb) => (
            <li key={fb.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted-foreground">{fb.pageUrl}</span>
                <StatusBadge status={fb.status} />
              </div>
              {fb.author ?? fb.thread[0]?.author ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Reported by{" "}
                  <span className="font-medium text-foreground">
                    {(fb.author ?? fb.thread[0]?.author)?.name}
                  </span>
                </p>
              ) : null}

              {fb.screenshotKey ? (
                <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-md border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={api.screenshotUrl(fb.id)}
                    alt="Pin screenshot"
                    className="size-full object-contain"
                  />
                  <span
                    aria-hidden
                    className="absolute size-5 -translate-x-1/2 -translate-y-full rounded-full rounded-bl-none border-2 border-primary-foreground bg-primary shadow"
                    style={{
                      left: `${fb.coordinates.xPercent * 100}%`,
                      top: `${fb.coordinates.yPercent * 100}%`,
                    }}
                  />
                </div>
              ) : (
                <div className="mt-3 flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-md border bg-muted text-xs text-muted-foreground">
                  <ImageOff className="size-5" aria-hidden />
                  <span>No screenshot</span>
                </div>
              )}

              <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{fb.selector}</p>

              {fb.thread.length === 0 ? (
                <p className="mt-3 text-sm italic text-muted-foreground">No comments.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {fb.thread.map((comment) => (
                    <li key={comment.id} className="rounded-md border bg-background p-3 text-sm">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium">{comment.author.name}</span>
                        <span className="text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words">{comment.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
