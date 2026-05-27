import type {
  CreateFeedbackInput,
  Feedback,
  FeedbackAuthor,
  FeedbackCoordinates,
  FeedbackStatus,
  FeedbackTransport,
  ListFeedbackResult,
} from "./types.js";

export type { FeedbackTransport };

/**
 * Default HTTP transport: talks to the API at `apiUrl` using a per-project
 * API key (`apiKey`, sent as `x-feedback-key`).
 *
 *   GET    /v1/feedback?pageUrl=…&status=…
 *   POST   /v1/feedback
 *   POST   /v1/feedback/:id/comments
 *   PATCH  /v1/feedback/:id  { status }                  (admin-only; SDK rarely calls this)
 *   PATCH  /v1/feedback/:id/coordinates  { coordinates } (drag-to-move)
 *   POST   /v1/feedback/:id/screenshot                   (multipart, field "file")
 *
 * The SDK never sends `projectId` — the server resolves the project from
 * the API key.
 */
export interface HttpTransportOptions {
  apiUrl: string;
  /** Per-project ingest key sent as `x-feedback-key`. Required. */
  apiKey: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}

export function createHttpTransport(options: HttpTransportOptions): FeedbackTransport {
  if (!options.apiKey) {
    throw new Error("createHttpTransport: `apiKey` is required");
  }
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const base = options.apiUrl.replace(/\/$/, "");

  function jsonHeaders(): HeadersInit {
    return {
      "content-type": "application/json",
      accept: "application/json",
      "x-feedback-key": options.apiKey,
      ...(options.headers ?? {}),
    };
  }

  function authHeaders(): Record<string, string> {
    return { "x-feedback-key": options.apiKey, ...(options.headers ?? {}) };
  }

  async function asJson<T>(res: Response): Promise<T> {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`feedback-sdk: ${res.status} ${res.statusText} ${text}`);
    }
    return (await res.json()) as T;
  }

  return {
    async list(query): Promise<ListFeedbackResult> {
      const params = new URLSearchParams();
      if (query.pageUrl) params.set("pageUrl", query.pageUrl);
      if (query.status) params.set("status", query.status);
      const qs = params.toString();
      const res = await fetchImpl(`${base}/v1/feedback${qs ? `?${qs}` : ""}`, {
        method: "GET",
        headers: jsonHeaders(),
      });
      return asJson<ListFeedbackResult>(res);
    },

    async create(input): Promise<Feedback> {
      // The server fills in `projectId` from the API key; we never send it.
      const { projectId: _ignored, ...payload } = input as CreateFeedbackInput & {
        projectId?: string;
      };
      void _ignored;
      const res = await fetchImpl(`${base}/v1/feedback`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(payload),
      });
      return asJson<Feedback>(res);
    },

    async reply(feedbackId, comment: { author: FeedbackAuthor; body: string }): Promise<Feedback> {
      const res = await fetchImpl(`${base}/v1/feedback/${encodeURIComponent(feedbackId)}/comments`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify(comment),
      });
      return asJson<Feedback>(res);
    },

    async setStatus(feedbackId, status: FeedbackStatus): Promise<Feedback> {
      const res = await fetchImpl(`${base}/v1/feedback/${encodeURIComponent(feedbackId)}`, {
        method: "PATCH",
        headers: jsonHeaders(),
        body: JSON.stringify({ status }),
      });
      return asJson<Feedback>(res);
    },

    async move(feedbackId, coordinates: FeedbackCoordinates): Promise<Feedback> {
      const res = await fetchImpl(
        `${base}/v1/feedback/${encodeURIComponent(feedbackId)}/coordinates`,
        {
          method: "PATCH",
          headers: jsonHeaders(),
          body: JSON.stringify({ coordinates }),
        }
      );
      return asJson<Feedback>(res);
    },

    async uploadScreenshot(feedbackId, blob: Blob): Promise<Feedback> {
      const form = new FormData();
      form.append("file", blob, `${feedbackId}.png`);
      const res = await fetchImpl(
        `${base}/v1/feedback/${encodeURIComponent(feedbackId)}/screenshot`,
        {
          method: "POST",
          headers: authHeaders(),
          body: form,
        }
      );
      return asJson<Feedback>(res);
    },
  };
}
