import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, ImageOff, MessageSquare, User } from "lucide-react";
import type { Feedback, FeedbackStatus } from "@mahmulp/shared-types";

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
  searchParams: Promise<{
    status?: string;
    pageUrl?: string;
    page?: string;
    limit?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function ProjectFeedbackPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { status: statusParam, pageUrl, page: pageParam, limit: limitParam, dateFrom, dateTo } = await searchParams;
  const status = isStatus(statusParam) ? statusParam : undefined;

  const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 20;

  // Fetch paginated items with all filters applied
  const { items, total, totalPages } = await api.listFeedback(slug, {
    status,
    pageUrl,
    page,
    limit,
    dateFrom,
    dateTo,
  });

  // Fetch unpaginated minimal set just to extract unique page URLs for filtering
  // This is fast enough for typical feedback volumes
  const { items: allItems } = await api.listFeedback(slug, { status, dateFrom, dateTo });
  const distinctPages = Array.from(new Set(allItems.map((f) => f.pageUrl))).sort();

  const offset = (page - 1) * limit;
  const startItem = total > 0 ? offset + 1 : 0;
  const endItem = Math.min(offset + items.length, total);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total > 0 ? `Showing ${startItem}–${endItem} of ${total} feedback items` : "0 feedback items"}
        </p>
        <a
          href={exportHref(slug, status, pageUrl, dateFrom, dateTo, page, limit)}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
        >
          <Download className="size-3.5" aria-hidden /> Export Excel
        </a>
      </div>

      <nav aria-label="Filters" className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((opt) => {
            const href = filterHref(slug, opt.value === "all" ? undefined : opt.value, pageUrl, 1, limit, dateFrom, dateTo);
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
                    href={filterHref(slug, status, active ? undefined : p, 1, limit, dateFrom, dateTo)}
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
        </div>

        {/* Date Filter Form */}
        <form method="get" className="flex flex-wrap items-center gap-2 text-xs">
          {status && <input type="hidden" name="status" value={status} />}
          {pageUrl && <input type="hidden" name="pageUrl" value={pageUrl} />}
          <input type="hidden" name="limit" value={limit} />
          <label className="text-muted-foreground">From:</label>
          <input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded border border-input px-2 py-1 bg-background text-foreground shadow-sm" />
          <label className="text-muted-foreground">To:</label>
          <input type="date" name="dateTo" defaultValue={dateTo} className="rounded border border-input px-2 py-1 bg-background text-foreground shadow-sm" />
          <button type="submit" className="rounded bg-primary px-2.5 py-1 text-primary-foreground hover:bg-primary/90 font-medium shadow-sm transition-colors">Filter</button>
          {(dateFrom || dateTo) && (
            <Link href={filterHref(slug, status, pageUrl, 1, limit)} className="text-muted-foreground hover:text-foreground">Clear</Link>
          )}
        </form>
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
                    {reporterName(fb) ? (
                      <span className="inline-flex items-center gap-1">
                        <User aria-hidden className="size-3" />
                        {reporterName(fb)}
                      </span>
                    ) : null}
                    <span>{new Date(fb.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Show:</span>
            {[10, 20, 50, 100].map((size) => {
              const isActive = limit === size;
              return (
                <Link
                  key={size}
                  href={filterHref(slug, status, pageUrl, 1, size, dateFrom, dateTo)}
                  className={[
                    "rounded px-2 py-1 font-medium transition-colors",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  ].join(" ")}
                >
                  {size}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-sm font-medium">
            <Link
              href={page > 1 ? filterHref(slug, status, pageUrl, page - 1, limit, dateFrom, dateTo) : "#"}
              className={[
                "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 shadow-sm transition-colors",
                page <= 1 ? "pointer-events-none opacity-50 bg-muted" : "bg-background hover:bg-accent"
              ].join(" ")}
              aria-disabled={page <= 1}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Link>
            <span className="px-2 text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Link
              href={page < totalPages ? filterHref(slug, status, pageUrl, page + 1, limit, dateFrom, dateTo) : "#"}
              className={[
                "inline-flex items-center gap-1 rounded-md border px-3 py-1.5 shadow-sm transition-colors",
                page >= totalPages ? "pointer-events-none opacity-50 bg-muted" : "bg-background hover:bg-accent"
              ].join(" ")}
              aria-disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function isStatus(v: unknown): v is FeedbackStatus {
  return v === "open" || v === "resolved" || v === "archived";
}

function filterHref(slug: string, status?: string, pageUrl?: string, page?: number, limit?: number, dateFrom?: string, dateTo?: string): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (pageUrl) params.set("pageUrl", pageUrl);
  if (page && page > 1) params.set("page", String(page));
  if (limit && limit !== 20) params.set("limit", String(limit));
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  const qs = params.toString();
  return `/projects/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`;
}

function exportHref(slug: string, status?: string, pageUrl?: string, dateFrom?: string, dateTo?: string, page?: number, limit?: number): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (pageUrl) params.set("pageUrl", pageUrl);
  if (dateFrom) params.set("dateFrom", dateFrom);
  if (dateTo) params.set("dateTo", dateTo);
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return `/projects/${encodeURIComponent(slug)}/export${qs ? `?${qs}` : ""}`;
}

function firstComment(thread: { body: string }[]): string | null {
  return thread[0]?.body ?? null;
}

/** Original reporter: the denormalized author, falling back to the first comment. */
function reporterName(fb: Feedback): string | null {
  return fb.author?.name ?? fb.thread[0]?.author.name ?? null;
}
