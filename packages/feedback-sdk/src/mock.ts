import type {
  CreateFeedbackInput,
  Feedback,
  FeedbackAuthor,
  FeedbackCoordinates,
  FeedbackStatus,
  FeedbackTransport,
  ListFeedbackQuery,
  ListFeedbackResult,
} from "@mahmulp/shared-types";

/**
 * In-memory transport for local development / demos / tests.
 *
 *   import { createMockTransport } from '@mahmulp/feedback-sdk/mock'
 *
 * No persistence, no network. Useful before the API is wired up.
 */

export interface MockTransportOptions {
  /** Optional initial feedback records (e.g. seeded from a fixture). */
  initial?: Feedback[];
  /** Override id generation (defaults to `fb_<timestamp>_<rand>`). */
  generateId?: () => string;
  /** Optional fake latency in ms, applied to every call. */
  latencyMs?: number;
}

export function createMockTransport(options: MockTransportOptions = {}): FeedbackTransport & {
  /** Direct read of the in-memory store for tests / debugging. */
  _all(): Feedback[];
  _reset(): void;
} {
  const items: Feedback[] = options.initial ? options.initial.map(clone) : [];
  const genId = options.generateId ?? defaultGenerateId;
  const latency = options.latencyMs ?? 0;

  async function delay() {
    if (latency > 0) await new Promise((r) => setTimeout(r, latency));
  }

  return {
    async list(query: ListFeedbackQuery): Promise<ListFeedbackResult> {
      await delay();
      const filtered = items
        .filter((f) => f.projectId === query.projectId)
        .filter((f) => (query.pageUrl ? f.pageUrl === query.pageUrl : true))
        .filter((f) => (query.status ? f.status === query.status : true))
        .map(clone);
      return { items: filtered };
    },

    async create(input: CreateFeedbackInput): Promise<Feedback> {
      await delay();
      const now = new Date().toISOString();
      const id = genId();
      const fb: Feedback = {
        id,
        projectId: input.projectId,
        pageUrl: input.pageUrl,
        selector: input.selector,
        coordinates: { ...input.coordinates },
        viewport: { ...input.viewport },
        status: "open",
        thread: input.comment
          ? [
              {
                id: `cm_${id}_0`,
                author: { ...input.comment.author },
                body: input.comment.body,
                createdAt: now,
              },
            ]
          : [],
        createdAt: now,
        updatedAt: now,
      };
      items.push(fb);
      return clone(fb);
    },

    async reply(
      feedbackId: string,
      comment: { author: FeedbackAuthor; body: string }
    ): Promise<Feedback> {
      await delay();
      const fb = items.find((f) => f.id === feedbackId);
      if (!fb) throw new Error(`feedback not found: ${feedbackId}`);
      const now = new Date().toISOString();
      fb.thread.push({
        id: `cm_${feedbackId}_${fb.thread.length}`,
        author: { ...comment.author },
        body: comment.body,
        createdAt: now,
      });
      fb.updatedAt = now;
      return clone(fb);
    },

    async setStatus(feedbackId: string, status: FeedbackStatus): Promise<Feedback> {
      await delay();
      const fb = items.find((f) => f.id === feedbackId);
      if (!fb) throw new Error(`feedback not found: ${feedbackId}`);
      fb.status = status;
      fb.updatedAt = new Date().toISOString();
      return clone(fb);
    },

    async move(feedbackId: string, coordinates: FeedbackCoordinates): Promise<Feedback> {
      await delay();
      const fb = items.find((f) => f.id === feedbackId);
      if (!fb) throw new Error(`feedback not found: ${feedbackId}`);
      fb.coordinates = { ...coordinates };
      fb.updatedAt = new Date().toISOString();
      return clone(fb);
    },

    async uploadScreenshot(feedbackId: string, _blob: Blob): Promise<Feedback> {
      await delay();
      const fb = items.find((f) => f.id === feedbackId);
      if (!fb) throw new Error(`feedback not found: ${feedbackId}`);
      fb.screenshotKey = `screenshots/${feedbackId}.png`;
      fb.updatedAt = new Date().toISOString();
      return clone(fb);
    },

    _all() {
      return items.map(clone);
    },
    _reset() {
      items.length = 0;
    },
  };
}

function defaultGenerateId(): string {
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clone<T>(value: T): T {
  // Structured clone is fine here; the records are plain JSON shapes.
  return JSON.parse(JSON.stringify(value)) as T;
}
