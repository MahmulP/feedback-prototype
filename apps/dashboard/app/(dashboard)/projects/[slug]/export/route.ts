import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import type { FeedbackStatus } from "@mahmulp/shared-types";

import { api, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isStatus(v: unknown): v is FeedbackStatus {
  return v === "open" || v === "resolved" || v === "archived";
}

/**
 * GET /projects/:slug/export — download all of a project's feedback as .xlsx.
 *
 * Two sheets:
 *   - "Feedback": one row per pin (status, reporter, timestamps, an "Has
 *     updates" flag derived from updatedAt > createdAt, position, screenshot).
 *   - "Comments": one row per comment/reply (so the whole thread, including
 *     replies, is exported).
 *
 * Respects the same `status` / `pageUrl` filters as the dashboard list when
 * present in the query string; otherwise exports everything.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const statusParam = req.nextUrl.searchParams.get("status") ?? undefined;
  const pageUrl = req.nextUrl.searchParams.get("pageUrl") ?? undefined;
  const status = isStatus(statusParam) ? statusParam : undefined;

  let project;
  let items;
  try {
    [project, { items }] = await Promise.all([
      api.getProject(slug),
      api.listFeedback(slug, { ...(status ? { status } : {}), ...(pageUrl ? { pageUrl } : {}) }),
    ]);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Feedback Dashboard";
  wb.created = new Date();

  // ----- Sheet 1: Feedback -----
  const fbSheet = wb.addWorksheet("Feedback");
  fbSheet.columns = [
    { header: "ID", key: "id", width: 22 },
    { header: "Page URL", key: "pageUrl", width: 32 },
    { header: "Status", key: "status", width: 12 },
    { header: "Reporter", key: "reporter", width: 20 },
    { header: "Reporter email", key: "reporterEmail", width: 26 },
    { header: "First comment", key: "firstComment", width: 50 },
    { header: "Comments", key: "comments", width: 10 },
    { header: "Has updates", key: "hasUpdates", width: 12 },
    { header: "Created at", key: "createdAt", width: 22 },
    { header: "Updated at", key: "updatedAt", width: 22 },
    { header: "Selector", key: "selector", width: 36 },
    { header: "Position", key: "position", width: 16 },
    { header: "Viewport", key: "viewport", width: 18 },
    { header: "Screenshot", key: "screenshot", width: 40 },
  ];
  fbSheet.getRow(1).font = { bold: true };
  fbSheet.views = [{ state: "frozen", ySplit: 1 }];
  fbSheet.autoFilter = "A1:N1";

  for (const fb of items) {
    const reporter = fb.author ?? fb.thread[0]?.author;
    fbSheet.addRow({
      id: fb.id,
      pageUrl: fb.pageUrl,
      status: fb.status,
      reporter: reporter?.name ?? "",
      reporterEmail: reporter?.email ?? "",
      firstComment: fb.thread[0]?.body ?? "",
      comments: fb.thread.length,
      hasUpdates: fb.updatedAt !== fb.createdAt ? "yes" : "no",
      createdAt: new Date(fb.createdAt),
      updatedAt: new Date(fb.updatedAt),
      selector: fb.selector,
      position: `${(fb.coordinates.xPercent * 100).toFixed(1)}% / ${(fb.coordinates.yPercent * 100).toFixed(1)}%`,
      viewport: `${fb.viewport.width}x${fb.viewport.height} @${fb.viewport.devicePixelRatio}x`,
      screenshot: fb.screenshotKey ? api.screenshotUrl(fb.id) : "",
    });
  }

  // ----- Sheet 2: Comments (every comment + reply) -----
  const cmSheet = wb.addWorksheet("Comments");
  cmSheet.columns = [
    { header: "Feedback ID", key: "feedbackId", width: 22 },
    { header: "Page URL", key: "pageUrl", width: 32 },
    { header: "#", key: "index", width: 6 },
    { header: "Type", key: "type", width: 12 },
    { header: "Author", key: "author", width: 20 },
    { header: "Author email", key: "email", width: 26 },
    { header: "Body", key: "body", width: 60 },
    { header: "Created at", key: "createdAt", width: 22 },
  ];
  cmSheet.getRow(1).font = { bold: true };
  cmSheet.views = [{ state: "frozen", ySplit: 1 }];
  cmSheet.autoFilter = "A1:H1";

  for (const fb of items) {
    fb.thread.forEach((comment, index) => {
      cmSheet.addRow({
        feedbackId: fb.id,
        pageUrl: fb.pageUrl,
        index: index + 1,
        type: index === 0 ? "feedback" : "reply",
        author: comment.author.name,
        email: comment.author.email ?? "",
        body: comment.body,
        createdAt: new Date(comment.createdAt),
      });
    });
  }
  cmSheet.getColumn("body").alignment = { wrapText: true, vertical: "top" };

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `feedback-${project.slug}-${stamp}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
