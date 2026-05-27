import type {
  CreateFeedbackInput,
  Feedback,
  FeedbackAuthor,
  FeedbackCoordinates,
  FeedbackStatus,
  ListFeedbackQuery,
} from "@mahmulp/shared-types";

/**
 * Persistence interface for feedback records.
 *
 * v1 ships with an in-memory implementation. The same interface will be
 * implemented on top of Postgres + Drizzle once the DB lands; routes only
 * see this contract.
 */
export interface ProjectSummary {
  projectId: string;
  totalFeedback: number;
  openFeedback: number;
}

export interface FeedbackStore {
  list(query: ListFeedbackQuery): Promise<Feedback[]>;
  get(id: string): Promise<Feedback | null>;
  create(input: CreateFeedbackInput): Promise<Feedback>;
  reply(id: string, comment: { author: FeedbackAuthor; body: string }): Promise<Feedback | null>;
  setStatus(id: string, status: FeedbackStatus): Promise<Feedback | null>;
  attachScreenshot(id: string, key: string): Promise<Feedback | null>;
  setCoordinates(id: string, coordinates: FeedbackCoordinates): Promise<Feedback | null>;
  listProjects(): Promise<ProjectSummary[]>;
}

export function createInMemoryStore(): FeedbackStore {
  const items = new Map<string, Feedback>();

  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  function nowIso(): string {
    return new Date().toISOString();
  }

  function generateId(): string {
    return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  return {
    async list(query: ListFeedbackQuery): Promise<Feedback[]> {
      const all = Array.from(items.values()).filter((f) => f.projectId === query.projectId);
      const filtered = all
        .filter((f) => (query.pageUrl ? f.pageUrl === query.pageUrl : true))
        .filter((f) => (query.status ? f.status === query.status : true))
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      return filtered.map(clone);
    },

    async get(id: string): Promise<Feedback | null> {
      const fb = items.get(id);
      return fb ? clone(fb) : null;
    },

    async create(input: CreateFeedbackInput): Promise<Feedback> {
      const id = generateId();
      const now = nowIso();
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
      items.set(id, fb);
      return clone(fb);
    },

    async reply(id: string, comment: { author: FeedbackAuthor; body: string }): Promise<Feedback | null> {
      const fb = items.get(id);
      if (!fb) return null;
      const now = nowIso();
      fb.thread.push({
        id: `cm_${id}_${fb.thread.length}`,
        author: { ...comment.author },
        body: comment.body,
        createdAt: now,
      });
      fb.updatedAt = now;
      return clone(fb);
    },

    async setStatus(id: string, status: FeedbackStatus): Promise<Feedback | null> {
      const fb = items.get(id);
      if (!fb) return null;
      fb.status = status;
      fb.updatedAt = nowIso();
      return clone(fb);
    },

    async attachScreenshot(id: string, key: string): Promise<Feedback | null> {
      const fb = items.get(id);
      if (!fb) return null;
      fb.screenshotKey = key;
      fb.updatedAt = nowIso();
      return clone(fb);
    },

    async setCoordinates(id: string, coordinates: FeedbackCoordinates): Promise<Feedback | null> {
      const fb = items.get(id);
      if (!fb) return null;
      fb.coordinates = { ...coordinates };
      fb.updatedAt = nowIso();
      return clone(fb);
    },

    async listProjects(): Promise<ProjectSummary[]> {
      const summaries = new Map<string, ProjectSummary>();
      for (const fb of items.values()) {
        const existing = summaries.get(fb.projectId) ?? {
          projectId: fb.projectId,
          totalFeedback: 0,
          openFeedback: 0,
        };
        existing.totalFeedback += 1;
        if (fb.status === "open") existing.openFeedback += 1;
        summaries.set(fb.projectId, existing);
      }
      return Array.from(summaries.values()).sort((a, b) =>
        a.projectId < b.projectId ? -1 : 1
      );
    },
  };
}
