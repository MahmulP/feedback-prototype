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

export type { FeedbackTransport };

/**
 * Default HTTP transport: talks to a Hono-style API at `apiUrl`.
 * Endpoints assumed (subject to confirmation when the API is implemented):
 *
 *   GET    /v1/feedback?projectId=â€¦&pageUrl=â€¦&status=â€¦
 *   POST   /v1/feedback
 *   POST   /v1/feedback/:id/comments
 *   PATCH  /v1/feedback/:id  { status }
 *   POST   /v1/feedback/:id/screenshot   (multipart, field "file")
 */
export interface HttpTransportOptions {
  apiUrl: string;
  /** Per-project ingest key sent as `x-feedback-key`. */
  apiKey?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export function createHttpTransport(options: HttpTransportOptions): FeedbackTransport {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const base = options.apiUrl.replace(/\/$/, "");

  function jsonHeaders(): HeadersInit {
    const h: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      ...(options.headers ?? {}),
    };
    if (options.apiKey) h["x-feedback-key"] = options.apiKey;
    return h;
  }

  async function asJson<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`feedback-sdk: ${res.status} ${res.statusText} ${text}`);
    }
    return (await res.json()) as T;
  }

  return {
    async list(query: ListFeedbackQuery): Promise<ListFeedbackResult> {
      const params = new URLSearchParams();
      params.set("projectId", query.projectId);
      if (query.pageUrl) params.set("pageUrl", query.pageUrl);
      if (query.status) params.set("status", query.status);
      const res = await fetchImpl(`${base}/v1/feedback?${params.toString()}`, {
        method: "GET",
        headers: jsonHeaders(),
      });
      return asJson<ListFeedbackResult>(res);
    },

    async create(input: CreateFeedbackInput): Promise<Feedback> {
      const res = await fetchImpl(`${base}/v1/feedback`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(input),
      });
      return asJson<Feedback>(res);
    },

    async reply(
      feedbackId: string,
      comment: { author: FeedbackAuthor; body: string }
    ): Promise<Feedback> {
      const res = await fetchImpl(`${base}/v1/feedback/${encodeURIComponent(feedbackId)}/comments`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(comment),
      });
      return asJson<Feedback>(res);
    },

    async setStatus(feedbackId: string, status: FeedbackStatus): Promise<Feedback> {
      const res = await fetchImpl(`${base}/v1/feedback/${encodeURIComponent(feedbackId)}`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ status }),
      });
      return asJson<Feedback>(res);
    },

    async move(feedbackId: string, coordinates: FeedbackCoordinates): Promise<Feedback> {
      const res = await fetchImpl(`${base}/v1/feedback/${encodeURIComponent(feedbackId)}/coordinates`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ coordinates }),
      });
      return asJson<Feedback>(res);
    },

    async uploadScreenshot(feedbackId: string, blob: Blob): Promise<Feedback> {
      const form = new FormData();
      form.append("file", blob, `${feedbackId}.png`);
      const headers: Record<string, string> = {};
      if (options.apiKey) headers["x-feedback-key"] = options.apiKey;
      if (options.headers) Object.assign(headers, options.headers);
      const res = await fetchImpl(
        `${base}/v1/feedback/${encodeURIComponent(feedbackId)}/screenshot`,
        {
          method: "POST",
          headers,
          body: form,
        }
      );
      return asJson<Feedback>(res);
    },
  };
}
