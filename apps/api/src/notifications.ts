import type { Feedback } from "@mahmulp/shared-types";
import type { ApiEnv } from "./env.js";
import type { Logger } from "./logger.js";
import type { Mailer } from "./mailer.js";
import type { FeedbackStore } from "./store.js";

/**
 * Owner-facing email notifications for feedback activity.
 *
 * The notifier resolves the project's owner, builds a human-readable message,
 * and hands it to the mailer. Every public method is **fire-and-forget safe**:
 * failures are logged and swallowed so a mail outage never breaks the SDK
 * ingest path or a dashboard reply.
 */

export interface Notifier {
  /** A brand-new feedback pin was created (usually from the SDK). */
  notifyNewFeedback(feedback: Feedback): void;
  /** A reply was appended to an existing feedback thread. */
  notifyNewReply(feedback: Feedback, comment: { author: { name: string; email?: string }; body: string }): void;
}

export class NoopNotifier implements Notifier {
  notifyNewFeedback(): void {}
  notifyNewReply(): void {}
}

interface NotifierDeps {
  env: ApiEnv;
  store: FeedbackStore;
  mailer: Mailer;
  logger: Logger;
}

export function createNotifier(deps: NotifierDeps): Notifier {
  if (!deps.mailer.enabled) return new NoopNotifier();
  return new EmailNotifier(deps);
}

/** One recorded activity item inside a project's pending digest. */
interface DigestItem {
  kind: "new" | "reply";
  feedbackId: string;
  pageUrl: string;
  selector: string;
  status: string;
  authorName: string;
  body: string;
  at: number;
}

interface PendingBatch {
  projectSlug: string;
  items: DigestItem[];
  timer: ReturnType<typeof setTimeout> | null;
  /** When the window opened (ms epoch). */
  openedAt: number;
}

class EmailNotifier implements Notifier {
  /** Per-project pending digests, keyed by project slug. */
  private batches = new Map<string, PendingBatch>();
  /** Per-project send timestamps (ms epoch) within the rolling hour cap. */
  private sentTimes = new Map<string, number[]>();

  constructor(private deps: NotifierDeps) {}

  notifyNewFeedback(feedback: Feedback): void {
    const latest = feedback.thread[feedback.thread.length - 1];
    this.enqueue(feedback.projectId, {
      kind: "new",
      feedbackId: feedback.id,
      pageUrl: feedback.pageUrl,
      selector: feedback.selector,
      status: feedback.status,
      authorName: latest?.author?.name ?? "Someone",
      body: (latest?.body ?? "").trim(),
      at: Date.now(),
    });
  }

  notifyNewReply(
    feedback: Feedback,
    comment: { author: { name: string; email?: string }; body: string }
  ): void {
    this.enqueue(feedback.projectId, {
      kind: "reply",
      feedbackId: feedback.id,
      pageUrl: feedback.pageUrl,
      selector: feedback.selector,
      status: feedback.status,
      authorName: comment.author?.name ?? "Someone",
      body: (comment.body ?? "").trim(),
      at: Date.now(),
    });
  }

  /**
   * Add an activity item to the project's pending digest. The first item opens
   * a window; subsequent items within the window join the same batch. When the
   * window closes the batch is flushed as a single email. With the window set
   * to 0 the item flushes immediately.
   */
  private enqueue(projectSlug: string, item: DigestItem): void {
    const windowMs = this.deps.env.EMAIL_DIGEST_WINDOW_SEC * 1000;

    if (windowMs <= 0) {
      // No batching: flush this single item right away.
      void this.flush({ projectSlug, items: [item], timer: null, openedAt: item.at }).catch((err) =>
        this.deps.logger.error("notify flush failed", { error: msg(err) })
      );
      return;
    }

    let batch = this.batches.get(projectSlug);
    if (!batch) {
      batch = { projectSlug, items: [], timer: null, openedAt: item.at };
      this.batches.set(projectSlug, batch);
      batch.timer = setTimeout(() => {
        const pending = this.batches.get(projectSlug);
        this.batches.delete(projectSlug);
        if (pending) {
          void this.flush(pending).catch((err) =>
            this.deps.logger.error("notify flush failed", { error: msg(err) })
          );
        }
      }, windowMs);
      // Don't keep the event loop alive just for a pending digest.
      (batch.timer as { unref?: () => void }).unref?.();
    }
    batch.items.push(item);
  }

  /** Enforce the per-project rolling-hour cap. Returns true when allowed. */
  private withinHourlyCap(projectSlug: string, now: number): boolean {
    const cap = this.deps.env.EMAIL_MAX_PER_HOUR;
    if (cap <= 0) return true;
    const hourAgo = now - 3_600_000;
    const recent = (this.sentTimes.get(projectSlug) ?? []).filter((t) => t > hourAgo);
    if (recent.length >= cap) {
      this.sentTimes.set(projectSlug, recent);
      return false;
    }
    recent.push(now);
    this.sentTimes.set(projectSlug, recent);
    return true;
  }

  /** Resolve the owner and send one digest email for the whole batch. */
  private async flush(batch: PendingBatch): Promise<void> {
    if (batch.items.length === 0) return;

    const project = await this.deps.store.getProject(batch.projectSlug);
    if (!project) {
      this.deps.logger.warn("notify skipped: project not found", { projectId: batch.projectSlug });
      return;
    }
    const owner = await this.deps.store.getUserById(project.ownerId);
    if (!owner?.email) {
      this.deps.logger.warn("notify skipped: owner has no email", { projectId: batch.projectSlug });
      return;
    }

    const now = Date.now();
    if (!this.withinHourlyCap(batch.projectSlug, now)) {
      this.deps.logger.warn("notify skipped: hourly cap reached", {
        projectId: batch.projectSlug,
        dropped: batch.items.length,
      });
      return;
    }

    const items = batch.items;
    const count = items.length;
    const newCount = items.filter((i) => i.kind === "new").length;
    const replyCount = count - newCount;

    const subject =
      count === 1
        ? items[0]!.kind === "new"
          ? `[${project.name}] New feedback on ${items[0]!.pageUrl}`
          : `[${project.name}] New reply on ${items[0]!.pageUrl}`
        : `[${project.name}] ${count} new feedback updates`;

    const summaryLine =
      count === 1
        ? items[0]!.kind === "new"
          ? `${items[0]!.authorName} left new feedback on "${project.name}".`
          : `${items[0]!.authorName} replied to a thread on "${project.name}".`
        : `${count} updates on "${project.name}"` +
          (newCount && replyCount
            ? ` (${newCount} new, ${replyCount} ${replyCount === 1 ? "reply" : "replies"}).`
            : newCount
              ? ` (${newCount} new).`
              : ` (${replyCount} ${replyCount === 1 ? "reply" : "replies"}).`);

    const link = this.dashboardLink(count === 1 ? items[0]!.feedbackId : null);

    const textLines: string[] = [summaryLine, ""];
    for (const it of items) {
      textLines.push(
        `• [${it.kind === "new" ? "NEW" : "REPLY"}] ${it.pageUrl}`,
        `    by ${it.authorName} — ${it.body || "(no text)"}`
      );
    }
    if (link) textLines.push("", `Open the dashboard: ${link}`);
    const text = textLines.join("\n");

    await this.deps.mailer.send({
      to: owner.email,
      subject,
      text,
      html: this.renderHtml({ projectName: project.name, summaryLine, items, link }),
    });

    this.deps.logger.info("notification digest sent", {
      projectId: batch.projectSlug,
      items: count,
      windowMs: now - batch.openedAt,
    });
  }

  private dashboardLink(feedbackId: string | null): string | null {
    const base = this.deps.env.DASHBOARD_URL;
    if (!base) return null;
    const root = base.replace(/\/$/, "");
    return feedbackId ? `${root}/feedback/${encodeURIComponent(feedbackId)}` : root;
  }

  private renderHtml(input: {
    projectName: string;
    summaryLine: string;
    items: DigestItem[];
    link: string | null;
  }): string {
    const rows = input.items
      .map((it) => {
        const tag =
          it.kind === "new"
            ? `<span style="background:#1F5132;color:#F5FFF8;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">NEW</span>`
            : `<span style="background:#2F7A4D;color:#F5FFF8;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px">REPLY</span>`;
        return `<tr><td style="padding:12px 0;border-top:1px solid #eef1f0">
          <div style="font-size:12px;color:#56635d;margin-bottom:4px">${tag} &nbsp;${escapeHtml(it.pageUrl)}</div>
          <div style="font-size:13px;color:#8a958f;margin-bottom:6px"><code>${escapeHtml(it.selector)}</code></div>
          <div style="font-size:14px;line-height:1.5;white-space:pre-wrap">${escapeHtml(it.authorName)}: ${escapeHtml(it.body || "(no text)")}</div>
        </td></tr>`;
      })
      .join("");
    const btn = input.link
      ? `<p style="margin:24px 0 0"><a href="${escapeAttr(input.link)}" style="background:#1F5132;color:#F5FFF8;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">View in dashboard</a></p>`
      : "";
    return `<!doctype html>
<html><body style="margin:0;background:#f4f6f5;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;color:#1a2420">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#fff;border:1px solid #e3e8e5;border-radius:12px;overflow:hidden">
      <tr><td style="background:#1F5132;padding:16px 24px;color:#F5FFF8;font-weight:600">Feedback</td></tr>
      <tr><td style="padding:24px">
        <p style="margin:0 0 8px;font-size:15px;line-height:1.5">${escapeHtml(input.summaryLine)}</p>
        <table role="presentation" width="100%" style="border-collapse:collapse">${rows}</table>
        ${btn}
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:11px;color:#9aa39e">You receive this because you own this project. Activity is batched to reduce email volume.</p>
  </td></tr></table>
</body></html>`;
  }
}

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
