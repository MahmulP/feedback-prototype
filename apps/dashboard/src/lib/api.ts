import "server-only";
import type { Feedback, FeedbackStatus } from "@mahmulp/shared-types";
import { serverEnv } from "./env";

export interface ProjectSummary {
  projectId: string;
  totalFeedback: number;
  openFeedback: number;
}

/**
 * Server-side API client. Used from Server Components, Route Handlers, and
 * Server Actions. Forwards the dashboard service key when configured.
 *
 * Browser code never imports this module â€” `import "server-only"` ensures
 * the bundle errors at build time if it ever does.
 */

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | undefined>;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const env = serverEnv();
  const url = new URL(path, env.FEEDBACK_API_URL);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  const headers = new Headers(opts.headers);
  headers.set("accept", "application/json");
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  if (env.DASHBOARD_API_KEY) headers.set("x-dashboard-key", env.DASHBOARD_API_KEY);

  const res = await fetch(url, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: opts.cache ?? "no-store",
  });

  if (!res.ok) {
    let code = "request_failed";
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { error?: { code?: string; message?: string } };
      if (data?.error?.code) code = data.error.code;
      if (data?.error?.message) message = data.error.message;
    } catch {
      /* ignore parse errors */
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  /** Health check â€” used to render an "API offline" banner instead of crashing the dashboard. */
  async health(): Promise<{ ok: boolean }> {
    try {
      return await request<{ ok: boolean }>("/health");
    } catch {
      return { ok: false };
    }
  },

  async listFeedback(query: {
    projectId: string;
    pageUrl?: string;
    status?: FeedbackStatus;
  }): Promise<{ items: Feedback[] }> {
    return request<{ items: Feedback[] }>("/v1/feedback", { query });
  },

  async getFeedback(id: string): Promise<Feedback | null> {
    try {
      return await request<Feedback>(`/v1/feedback/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  /** List the distinct projectIds we've seen so the dashboard can show a project list. */
  async listProjects(): Promise<{ items: ProjectSummary[] }> {
    return request<{ items: ProjectSummary[] }>("/v1/projects");
  },

  async setStatus(id: string, status: FeedbackStatus): Promise<Feedback> {
    return request<Feedback>(`/v1/feedback/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status },
    });
  },

  async reply(id: string, comment: { author: { name: string; email?: string }; body: string }): Promise<Feedback> {
    return request<Feedback>(`/v1/feedback/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      body: comment,
    });
  },

  /** URL the browser hits directly for screenshot images. Built from public env. */
  screenshotUrl(id: string): string {
    return `${process.env.NEXT_PUBLIC_FEEDBACK_API_URL ?? ""}/v1/feedback/${encodeURIComponent(id)}/screenshot`;
  },
};

export { ApiError };
