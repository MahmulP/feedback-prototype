import type {
  CreateFeedbackInput,
  CreateProjectInput,
  Feedback,
  FeedbackAuthor,
  FeedbackCoordinates,
  FeedbackStatus,
  ListFeedbackQuery,
  Project,
  ProjectApiKeyMetadata,
  ProjectSummary,
  UpdateProjectInput,
  User,
} from "@mahmulp/shared-types";

/**
 * Persistence interface for the platform.
 *
 * v1 ships with an in-memory implementation. The same interface will be
 * implemented on top of Postgres + Drizzle when `DATABASE_URL` is set; routes
 * only see this contract.
 */
export interface FeedbackStore {
  // --- users
  createUser(input: { email: string; name: string; passwordHash: string }): Promise<User>;
  getUserByEmail(email: string): Promise<{ user: User; passwordHash: string } | null>;
  getUserById(id: string): Promise<User | null>;

  // --- projects (owner-scoped)
  createProject(ownerId: string, input: CreateProjectInput): Promise<Project>;
  getProject(slug: string): Promise<Project | null>;
  listProjectsForOwner(ownerId: string): Promise<ProjectSummary[]>;
  updateProject(slug: string, ownerId: string, input: UpdateProjectInput): Promise<Project | null>;
  deleteProject(slug: string, ownerId: string): Promise<boolean>;

  // --- project api keys
  createProjectApiKey(
    projectId: string,
    input: { keyHash: string; prefix: string }
  ): Promise<ProjectApiKeyMetadata>;
  listProjectApiKeys(projectId: string): Promise<ProjectApiKeyMetadata[]>;
  deleteProjectApiKey(id: string, projectId: string): Promise<boolean>;
  /** Look up which project a presented key hash belongs to. Touches `last_used_at`. */
  resolveProjectByKeyHash(keyHash: string): Promise<Project | null>;

  // --- feedback (scoped per project)
  list(query: ListFeedbackQuery): Promise<Feedback[]>;
  get(id: string): Promise<Feedback | null>;
  create(input: CreateFeedbackInput): Promise<Feedback>;
  reply(id: string, comment: { author: FeedbackAuthor; body: string }): Promise<Feedback | null>;
  setStatus(id: string, status: FeedbackStatus): Promise<Feedback | null>;
  setCoordinates(id: string, coordinates: FeedbackCoordinates): Promise<Feedback | null>;
  attachScreenshot(id: string, key: string): Promise<Feedback | null>;
}

export type { ProjectSummary };

interface StoredProject extends Project {}

interface StoredUser extends User {
  passwordHash: string;
}

interface StoredApiKey extends ProjectApiKeyMetadata {
  keyHash: string;
}

export function createInMemoryStore(): FeedbackStore {
  const users = new Map<string, StoredUser>();
  const usersByEmail = new Map<string, string>();
  const projects = new Map<string, StoredProject>();
  const apiKeys = new Map<string, StoredApiKey>();
  const apiKeysByHash = new Map<string, string>();
  const feedbackItems = new Map<string, Feedback>();

  function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  function nowIso(): string {
    return new Date().toISOString();
  }
  function generateId(prefix: string): string {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  return {
    // --- users -------------------------------------------------------
    async createUser(input) {
      const lower = input.email.toLowerCase();
      if (usersByEmail.has(lower)) {
        throw new Error("user_exists");
      }
      const id = generateId("usr");
      const user: StoredUser = {
        id,
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        createdAt: nowIso(),
      };
      users.set(id, user);
      usersByEmail.set(lower, id);
      const { passwordHash, ...publicUser } = user;
      void passwordHash;
      return clone(publicUser);
    },

    async getUserByEmail(email) {
      const id = usersByEmail.get(email.toLowerCase());
      if (!id) return null;
      const u = users.get(id);
      if (!u) return null;
      const { passwordHash, ...publicUser } = u;
      return { user: clone(publicUser), passwordHash };
    },

    async getUserById(id) {
      const u = users.get(id);
      if (!u) return null;
      const { passwordHash, ...publicUser } = u;
      void passwordHash;
      return clone(publicUser);
    },

    // --- projects ----------------------------------------------------
    async createProject(ownerId, input) {
      const slug = input.slug.trim().toLowerCase();
      if (projects.has(slug)) {
        throw new Error("project_exists");
      }
      const project: StoredProject = {
        id: generateId("prj"),
        ownerId,
        slug,
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        allowedOrigins: input.allowedOrigins ?? [],
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      projects.set(slug, project);
      return clone(project);
    },

    async getProject(slug) {
      const p = projects.get(slug.toLowerCase());
      return p ? clone(p) : null;
    },

    async listProjectsForOwner(ownerId) {
      const summaries: ProjectSummary[] = [];
      for (const project of projects.values()) {
        if (project.ownerId !== ownerId) continue;
        let total = 0;
        let open = 0;
        for (const fb of feedbackItems.values()) {
          if (fb.projectId !== project.slug) continue;
          total += 1;
          if (fb.status === "open") open += 1;
        }
        summaries.push({ ...clone(project), totalFeedback: total, openFeedback: open });
      }
      return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async updateProject(slug, ownerId, input) {
      const project = projects.get(slug.toLowerCase());
      if (!project || project.ownerId !== ownerId) return null;
      if (input.name !== undefined) project.name = input.name;
      if (input.description !== undefined) project.description = input.description;
      if (input.allowedOrigins !== undefined) project.allowedOrigins = [...input.allowedOrigins];
      project.updatedAt = nowIso();
      return clone(project);
    },

    async deleteProject(slug, ownerId) {
      const project = projects.get(slug.toLowerCase());
      if (!project || project.ownerId !== ownerId) return false;
      projects.delete(slug.toLowerCase());
      // cascade: drop keys and feedback
      for (const [id, key] of apiKeys) {
        if (key.projectId === project.id) {
          apiKeys.delete(id);
          apiKeysByHash.delete(key.keyHash);
        }
      }
      for (const [id, fb] of feedbackItems) {
        if (fb.projectId === project.slug) feedbackItems.delete(id);
      }
      return true;
    },

    // --- project api keys -------------------------------------------
    async createProjectApiKey(projectId, input) {
      const key: StoredApiKey = {
        id: generateId("pk"),
        projectId,
        keyHash: input.keyHash,
        prefix: input.prefix,
        createdAt: nowIso(),
      };
      apiKeys.set(key.id, key);
      apiKeysByHash.set(key.keyHash, key.id);
      const { keyHash, ...publicKey } = key;
      void keyHash;
      return clone(publicKey);
    },

    async listProjectApiKeys(projectId) {
      const list: ProjectApiKeyMetadata[] = [];
      for (const key of apiKeys.values()) {
        if (key.projectId !== projectId) continue;
        const { keyHash, ...publicKey } = key;
        void keyHash;
        list.push(clone(publicKey));
      }
      return list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    },

    async deleteProjectApiKey(id, projectId) {
      const key = apiKeys.get(id);
      if (!key || key.projectId !== projectId) return false;
      apiKeys.delete(id);
      apiKeysByHash.delete(key.keyHash);
      return true;
    },

    async resolveProjectByKeyHash(keyHash) {
      const id = apiKeysByHash.get(keyHash);
      if (!id) return null;
      const key = apiKeys.get(id);
      if (!key) return null;
      key.lastUsedAt = nowIso();
      // Project is keyed by slug; find the matching one.
      for (const project of projects.values()) {
        if (project.id === key.projectId) return clone(project);
      }
      return null;
    },

    // --- feedback ----------------------------------------------------
    async list(query) {
      const all = Array.from(feedbackItems.values()).filter((f) => f.projectId === query.projectId);
      const filtered = all
        .filter((f) => (query.pageUrl ? f.pageUrl === query.pageUrl : true))
        .filter((f) => (query.status ? f.status === query.status : true))
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      return filtered.map(clone);
    },

    async get(id) {
      const fb = feedbackItems.get(id);
      return fb ? clone(fb) : null;
    },

    async create(input) {
      const id = generateId("fb");
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
      feedbackItems.set(id, fb);
      return clone(fb);
    },

    async reply(id, comment) {
      const fb = feedbackItems.get(id);
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

    async setStatus(id, status) {
      const fb = feedbackItems.get(id);
      if (!fb) return null;
      fb.status = status;
      fb.updatedAt = nowIso();
      return clone(fb);
    },

    async setCoordinates(id, coordinates) {
      const fb = feedbackItems.get(id);
      if (!fb) return null;
      fb.coordinates = { ...coordinates };
      fb.updatedAt = nowIso();
      return clone(fb);
    },

    async attachScreenshot(id, key) {
      const fb = feedbackItems.get(id);
      if (!fb) return null;
      fb.screenshotKey = key;
      fb.updatedAt = nowIso();
      return clone(fb);
    },
  };
}
