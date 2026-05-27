import Link from "next/link";
import { ImageOff, MessageSquare } from "lucide-react";
import type { FeedbackStatus } from "@mahmulp/shared-types";

import { StatusBadge } from "@/components/status-badge";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { value: FeedbackStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
];

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; pageUrl?: string }>;
}

export default async function ProjectFeedbackPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { status: statusParam, pageUrl } = await searchParams;
  const status = isStatus(statusParam) ? statusParam : undefined;
  const { items } = await api.listFeedback(slug, { status, pageUrl });
  const distinctPages = Array.from(new Set(items.map((f) => f.pageUrl))).sort();

  return (
    <div className="space-y-4">
      <nav aria-label="Filters" className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((opt) => {
          const href = filterHref(slug, opt.value === "all" ? undefined : opt.value, pageUrl);
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
        {distinctPages.length > 1 ? (
          <div className="ml-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Pages:</span>
            {distinctPages.map((p) => {
              const active = pageUrl === p;
              return (
                <Link
                  key={p}
                  href={filterHref(slug, status, active ? undefined : p)}
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
        ) : null}
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
                href={`/projects/${encodeURIComponent(slug)}/feedback/${encodeURIComponent(fb.id)}`}
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

function filterHref(slug: string, status?: string, pageUrl?: string): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (pageUrl) params.set("pageUrl", pageUrl);
  const qs = params.toString();
  return `/projects/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`;
}

function firstComment(thread: { body: string }[]): string | null {
  return thread[0]?.body ?? null;
}
