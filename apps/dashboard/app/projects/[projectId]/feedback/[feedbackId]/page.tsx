import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ImageOff } from "lucide-react";

import { ApiOfflineBanner } from "@/components/api-status";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { publicEnv } from "@/lib/env";

import { ReplyForm } from "./reply-form";
import { StatusControls } from "./status-controls";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ projectId: string; feedbackId: string }>;
}

export default async function FeedbackDetailPage({ params }: PageProps) {
  const { projectId, feedbackId } = await params;

  const health = await api.health();
  if (!health.ok) {
    return <ApiOfflineBanner apiUrl={publicEnv().NEXT_PUBLIC_FEEDBACK_API_URL} />;
  }

  const fb = await api.getFeedback(feedbackId);
  if (!fb || fb.projectId !== projectId) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href={`/projects/${encodeURIComponent(projectId)}`}>
            <ChevronLeft className="size-4" aria-hidden />
            Back to feedback
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            <Link
              className="hover:text-foreground"
              href={`/projects/${encodeURIComponent(projectId)}`}
            >
              {projectId}
            </Link>
          </p>
          <h1 className="break-all font-mono text-xl font-semibold tracking-tight">{fb.id}</h1>
          <p className="font-mono text-xs text-muted-foreground">{fb.pageUrl}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={fb.status} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pin context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ScreenshotPreview feedbackId={fb.id} hasScreenshot={!!fb.screenshotKey} coordinates={fb.coordinates} />
            <dl className="grid grid-cols-3 gap-y-2 text-xs">
              <dt className="col-span-1 text-muted-foreground">Selector</dt>
              <dd className="col-span-2 break-all font-mono">{fb.selector}</dd>

              <dt className="col-span-1 text-muted-foreground">Position</dt>
              <dd className="col-span-2 font-mono">
                {(fb.coordinates.xPercent * 100).toFixed(1)}% × {(fb.coordinates.yPercent * 100).toFixed(1)}%
                <span className="ml-2 opacity-60">
                  ({fb.coordinates.xPx}, {fb.coordinates.yPx} px)
                </span>
              </dd>

              <dt className="col-span-1 text-muted-foreground">Viewport</dt>
              <dd className="col-span-2 font-mono">
                {fb.viewport.width} × {fb.viewport.height} @ {fb.viewport.devicePixelRatio}x
              </dd>

              <dt className="col-span-1 text-muted-foreground">Created</dt>
              <dd className="col-span-2">{new Date(fb.createdAt).toLocaleString()}</dd>

              <dt className="col-span-1 text-muted-foreground">Updated</dt>
              <dd className="col-span-2">{new Date(fb.updatedAt).toLocaleString()}</dd>
            </dl>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Status</p>
              <StatusControls
                projectId={projectId}
                feedbackId={fb.id}
                status={fb.status}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Thread <span className="text-muted-foreground">({fb.thread.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fb.thread.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {fb.thread.map((comment) => (
                  <li
                    key={comment.id}
                    className="rounded-md border bg-background p-3 text-sm shadow-sm"
                  >
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
            <Separator />
            <ReplyForm projectId={projectId} feedbackId={fb.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ScreenshotPreview({
  feedbackId,
  hasScreenshot,
  coordinates,
}: {
  feedbackId: string;
  hasScreenshot: boolean;
  coordinates: { xPercent: number; yPercent: number };
}) {
  if (!hasScreenshot) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-md border bg-muted text-xs text-muted-foreground">
        <ImageOff className="size-5" aria-hidden />
        <span>No screenshot captured.</span>
      </div>
    );
  }
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={api.screenshotUrl(feedbackId)}
        alt="Pin screenshot"
        className="size-full object-contain"
      />
      <span
        aria-hidden
        className="absolute size-5 -translate-x-1/2 -translate-y-full rounded-full rounded-bl-none border-2 border-primary-foreground bg-primary shadow"
        style={{
          left: `${coordinates.xPercent * 100}%`,
          top: `${coordinates.yPercent * 100}%`,
        }}
      />
    </div>
  );
}
