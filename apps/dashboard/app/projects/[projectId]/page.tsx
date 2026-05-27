import Link from "next/link";
import { ChevronLeft, ImageOff, MessageSquare } from "lucide-react";

import { ApiOfflineBanner } from "@/components/api-status";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { publicEnv } from "@/lib/env";
import type { FeedbackStatus } from "@mahmulp/shared-types";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { value: FeedbackStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
];

interface PageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ status?: string; pageUrl?: string }>;
}

export default async function ProjectFeedbackPage({ params, searchParams }: PageProps) {
  const { projectId } = await params;
  const { status: statusParam, pageUrl } = await searchParams;

  const health = await api.health();
  if (!health.ok) {
    return <ApiOfflineBanner apiUrl={publicEnv().NEXT_PUBLIC_FEEDBACK_API_URL} />;
  }

  const status = isStatus(statusParam) ? statusParam : undefined;
  const { items } = await api.listFeedback({ projectId, status, pageUrl });

  const distinctPages = Array.from(new Set(items.map((f) => f.pageUrl))).sort();

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/projects">
            <ChevronLeft className="size-4" aria-hidden />
            All projects
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Project</p>
          <h1 className="break-all font-mono text-2xl font-semibold tracking-tight">{projectId}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "pin" : "pins"}
          {status ? ` Â· ${status}` : ""}
          {pageUrl ? ` Â· ${pageUrl}` : ""}
        </p>
      </header>

      <nav aria-label="Filters" className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((opt) => {
          const href = filterHref(projectId, opt.value === "all" ? undefined : opt.value, pageUrl);
          const active = (status ?? "all") === opt.value;
          return (
            <Link
              key={opt.value}
              href={href}
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent",
              ].join(" ")}
            >
              {opt.label}
            </Link>
          );
        })}
        {distinctPages.length > 1 && (
          <div className="ml-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Pages:</span>
            {distinctPages.map((p) => {
              const active = pageUrl === p;
              return (
                <Link
                  key={p}
                  href={filterHref(projectId, status, active ? undefined : p)}
                  className={[
                    "rounded-md border px-2 py-0.5 font-mono text-[11px]",
                    active
                      ? "border-primary text-primary"
                      : "border-input text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {p}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      {items.length === 0 ? (
        <p className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">
          No feedback matches these filters.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((fb) => (
            <li key={fb.id}>
              <Link
                href={`/projects/${encodeURIComponent(projectId)}/feedback/${encodeURIComponent(fb.id)}`}
                className="flex items-start gap-4 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {fb.screenshotKey ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={api.screenshotUrl(fb.id)}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <ImageOff aria-hidden className="size-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={fb.status} />
                    <span className="truncate font-mono text-xs text-muted-foreground">{fb.pageUrl}</span>
                  </div>
                  <p className="line-clamp-2 text-sm">
                    {firstComment(fb.thread) ?? <em className="text-muted-foreground">No comment yet</em>}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MessageSquare aria-hidden className="size-3" />
                      {fb.thread.length}
                    </span>
                    <span>{new Date(fb.createdAt).toLocaleString()}</span>
                    {fb.thread[0]?.author?.name ? <span>by {fb.thread[0].author.name}</span> : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function isStatus(v: unknown): v is FeedbackStatus {
  return v === "open" || v === "resolved" || v === "archived";
}

function filterHref(projectId: string, status?: string, pageUrl?: string): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (pageUrl) params.set("pageUrl", pageUrl);
  const qs = params.toString();
  return `/projects/${encodeURIComponent(projectId)}${qs ? `?${qs}` : ""}`;
}

function firstComment(thread: { body: string }[]): string | null {
  return thread[0]?.body ?? null;
}
