import "server-only";
import { cookies } from "next/headers";
import type {
  Feedback,
  FeedbackStatus,
  ListFeedbackResult,
  Project,
  ProjectApiKeyMetadata,
  ProjectApiKeyIssued,
  ProjectMember,
  ProjectShareLink,
  ProjectShareLinkIssued,
  ProjectSummary,
  ProjectWithRole,
  SharedProjectInfo,
  SharedRole,
  User,
} from "@mahmulp/shared-types";
import { serverEnv } from "./env";

/**
 * Server-side API client. Forwards the user's session cookie to the API so
 * every request is authenticated as the logged-in dashboard user. Browser
 * code never imports this file (`import "server-only"` enforces it).
 */

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** When true, do *not* attach the session cookie (useful for the login route). */
  anonymous?: boolean;
}

export class ApiError extends Error {
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
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  const headers = new Headers(opts.headers);
  headers.set("accept", "application/json");
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  if (!opts.anonymous) {
    const cookieStore = await cookies();
    const session = cookieStore.get("mahmulp_session");
    if (session) headers.set("cookie", `mahmulp_session=${session.value}`);
  }

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
      /* ignore */
    }
    throw new ApiError(res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Returns the response Set-Cookie headers (used to echo session cookies through Server Actions). */
async function rawRequest(path: string, opts: RequestOptions = {}): Promise<Response> {
  const env = serverEnv();
  const url = new URL(path, env.FEEDBACK_API_URL);
  const headers = new Headers(opts.headers);
  headers.set("accept", "application/json");
  if (opts.body !== undefined) headers.set("content-type", "application/json");
  return fetch(url, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
}

export const api = {
  async health(): Promise<{ ok: boolean }> {
    try {
      return await request<{ ok: boolean }>("/health", { anonymous: true });
    } catch {
      return { ok: false };
    }
  },

  // --- auth (returns a Response so server actions can echo Set-Cookie)
  async signup(input: { email: string; password: string; name: string }) {
    return rawRequest("/v1/auth/signup", { method: "POST", body: input });
  },
  async login(input: { email: string; password: string }) {
    return rawRequest("/v1/auth/login", { method: "POST", body: input });
  },
  async logout() {
    return rawRequest("/v1/auth/logout", { method: "POST" });
  },
  async me(): Promise<{ user: User } | null> {
    try {
      return await request<{ user: User }>("/v1/auth/me");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },

  // --- projects
  async listProjects(): Promise<{ items: ProjectSummary[] }> {
    return request<{ items: ProjectSummary[] }>("/v1/projects");
  },
  async createProject(input: {
    slug: string;
    name: string;
    description?: string;
    allowedOrigins?: string[];
  }): Promise<Project> {
    return request<Project>("/v1/projects", { method: "POST", body: input });
  },
  async getProject(slug: string): Promise<ProjectWithRole | null> {
    try {
      return await request<ProjectWithRole>(`/v1/projects/${encodeURIComponent(slug)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
  async updateProject(
    slug: string,
    input: { name?: string; description?: string; allowedOrigins?: string[] }
  ): Promise<Project> {
    return request<Project>(`/v1/projects/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: input,
    });
  },
  async deleteProject(slug: string): Promise<void> {
    await request<{ ok: true }>(`/v1/projects/${encodeURIComponent(slug)}`, { method: "DELETE" });
  },

  // --- project API keys
  async listProjectKeys(slug: string): Promise<{ items: ProjectApiKeyMetadata[] }> {
    return request<{ items: ProjectApiKeyMetadata[] }>(`/v1/projects/${encodeURIComponent(slug)}/keys`);
  },
  async issueProjectKey(slug: string): Promise<ProjectApiKeyIssued> {
    return request<ProjectApiKeyIssued>(`/v1/projects/${encodeURIComponent(slug)}/keys`, {
      method: "POST",
      body: {},
    });
  },
  async deleteProjectKey(slug: string, keyId: string): Promise<void> {
    await request<{ ok: true }>(
      `/v1/projects/${encodeURIComponent(slug)}/keys/${encodeURIComponent(keyId)}`,
      { method: "DELETE" }
    );
  },

  // --- project members (sharing)
  async listProjectMembers(slug: string): Promise<{ items: ProjectMember[] }> {
    return request<{ items: ProjectMember[] }>(`/v1/projects/${encodeURIComponent(slug)}/members`);
  },
  async addProjectMember(slug: string, input: { email: string; role: SharedRole }): Promise<ProjectMember> {
    return request<ProjectMember>(`/v1/projects/${encodeURIComponent(slug)}/members`, {
      method: "POST",
      body: input,
    });
  },
  async removeProjectMember(slug: string, memberId: string): Promise<void> {
    await request<{ ok: true }>(
      `/v1/projects/${encodeURIComponent(slug)}/members/${encodeURIComponent(memberId)}`,
      { method: "DELETE" }
    );
  },

  // --- project share links (owner-managed)
  async listShareLinks(slug: string): Promise<{ items: ProjectShareLink[] }> {
    return request<{ items: ProjectShareLink[] }>(`/v1/projects/${encodeURIComponent(slug)}/share-links`);
  },
  async createShareLink(
    slug: string,
    input: { label?: string; expiresInDays?: number } = {}
  ): Promise<ProjectShareLinkIssued> {
    return request<ProjectShareLinkIssued>(`/v1/projects/${encodeURIComponent(slug)}/share-links`, {
      method: "POST",
      body: input,
    });
  },
  async deleteShareLink(slug: string, linkId: string): Promise<void> {
    await request<{ ok: true }>(
      `/v1/projects/${encodeURIComponent(slug)}/share-links/${encodeURIComponent(linkId)}`,
      { method: "DELETE" }
    );
  },

  // --- public share views (read-only, consumed by /share/[token])
  // No session cookie; the share token is the credential (sent as x-share-token).
  share: {
    async project(token: string): Promise<SharedProjectInfo | null> {
      try {
        return await request<SharedProjectInfo>("/v1/share/project", {
          anonymous: true,
          headers: { "x-share-token": token },
        });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) return null;
        throw err;
      }
    },
    async listFeedback(
      token: string,
      query: { pageUrl?: string; status?: FeedbackStatus; limit?: number; page?: number; dateFrom?: string; dateTo?: string } = {}
    ): Promise<ListFeedbackResult> {
      return request<ListFeedbackResult>("/v1/share/feedback", {
        anonymous: true,
        headers: { "x-share-token": token },
        query,
      });
    },
    async getFeedback(token: string, id: string): Promise<Feedback | null> {
      try {
        return await request<Feedback>(`/v1/share/feedback/${encodeURIComponent(id)}`, {
          anonymous: true,
          headers: { "x-share-token": token },
        });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) return null;
        throw err;
      }
    },
  },

  // --- feedback (dashboard reads, scoped to owner)
  async listFeedback(slug: string, query: { pageUrl?: string; status?: FeedbackStatus; limit?: number; page?: number; dateFrom?: string; dateTo?: string } = {}): Promise<ListFeedbackResult> {
    return request<ListFeedbackResult>(`/v1/projects/${encodeURIComponent(slug)}/feedback`, { query });
  },
  async getFeedback(id: string): Promise<Feedback | null> {
    try {
      return await request<Feedback>(`/v1/feedback/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
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

  screenshotUrl(id: string): string {
    return `${process.env.NEXT_PUBLIC_FEEDBACK_API_URL ?? ""}/v1/feedback/${encodeURIComponent(id)}/screenshot`;
  },
};
