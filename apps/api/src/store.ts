import type {
  CreateFeedbackInput,
  CreateProjectInput,
  Feedback,
  FeedbackAuthor,
  FeedbackCoordinates,
  FeedbackStatus,
  ListFeedbackQuery,
  ListFeedbackResult,
  Project,
  ProjectApiKeyMetadata,
  ProjectMember,
  ProjectRole,
  ProjectShareLink,
  ProjectSummary,
  SharedRole,
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
  /** Projects the user can see: owned (role "owner") + shared (role "member"). */
  listProjectsForUser(userId: string): Promise<ProjectSummary[]>;
  /** Resolve a project + the user's role, or null when the user has no access. */
  getProjectForUser(slug: string, userId: string): Promise<{ project: Project; role: ProjectRole } | null>;
  updateProject(slug: string, ownerId: string, input: UpdateProjectInput): Promise<Project | null>;
  deleteProject(slug: string, ownerId: string): Promise<boolean>;

  // --- project members (sharing)
  /** Share a project with an existing user at a given role. Throws "already_member" on duplicate. */
  addProjectMember(
    projectId: string,
    user: { id: string; email: string; name: string },
    role: SharedRole
  ): Promise<ProjectMember>;
  listProjectMembers(projectId: string): Promise<ProjectMember[]>;
  removeProjectMember(memberId: string, projectId: string): Promise<boolean>;
  getMembership(projectId: string, userId: string): Promise<ProjectMember | null>;

  // --- project share links (public, read-only)
  createShareLink(
    projectId: string,
    input: { tokenHash: string; prefix: string; label?: string; expiresAt?: string }
  ): Promise<ProjectShareLink>;
  listShareLinks(projectId: string): Promise<ProjectShareLink[]>;
  deleteShareLink(id: string, projectId: string): Promise<boolean>;
  /** Resolve the project a share token grants read access to. Skips expired/unknown tokens. Touches `last_used_at`. */
  resolveProjectByShareTokenHash(tokenHash: string): Promise<Project | null>;

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
  list(query: ListFeedbackQuery): Promise<ListFeedbackResult>;
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

interface StoredMember extends ProjectMember {}

interface StoredShareLink extends ProjectShareLink {
  tokenHash: string;
}

export function createInMemoryStore(): FeedbackStore {
  const users = new Map<string, StoredUser>();
  const usersByEmail = new Map<string, string>();
  const projects = new Map<string, StoredProject>();
  const apiKeys = new Map<string, StoredApiKey>();
  const apiKeysByHash = new Map<string, string>();
  const members = new Map<string, StoredMember>();
  const shareLinks = new Map<string, StoredShareLink>();
  const shareLinksByHash = new Map<string, string>();
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

    async listProjectsForUser(userId) {
      const accessible: { project: StoredProject; role: ProjectRole }[] = [];
      for (const project of projects.values()) {
        if (project.ownerId === userId) accessible.push({ project, role: "owner" });
      }
      for (const member of members.values()) {
        if (member.userId !== userId) continue;
        const project = [...projects.values()].find((p) => p.id === member.projectId);
        if (project && project.ownerId !== userId) accessible.push({ project, role: member.role });
      }
      const summaries: ProjectSummary[] = [];
      for (const { project, role } of accessible) {
        let total = 0;
        let open = 0;
        for (const fb of feedbackItems.values()) {
          if (fb.projectId !== project.slug) continue;
          total += 1;
          if (fb.status === "open") open += 1;
        }
        summaries.push({ ...clone(project), totalFeedback: total, openFeedback: open, role });
      }
      return summaries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    },

    async getProjectForUser(slug, userId) {
      const project = projects.get(slug.toLowerCase());
      if (!project) return null;
      if (project.ownerId === userId) return { project: clone(project), role: "owner" };
      for (const member of members.values()) {
        if (member.projectId === project.id && member.userId === userId) {
          return { project: clone(project), role: member.role };
        }
      }
      return null;
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
      for (const [id, member] of members) {
        if (member.projectId === project.id) members.delete(id);
      }
      for (const [id, link] of shareLinks) {
        if (link.projectId === project.id) {
          shareLinks.delete(id);
          shareLinksByHash.delete(link.tokenHash);
        }
      }
      return true;
    },

    // --- project members (sharing) ----------------------------------
    async addProjectMember(projectId, user, role) {
      for (const existing of members.values()) {
        if (existing.projectId === projectId && existing.userId === user.id) {
          throw new Error("already_member");
        }
      }
      const member: StoredMember = {
        id: generateId("pm"),
        projectId,
        userId: user.id,
        email: user.email,
        name: user.name,
        role,
        createdAt: nowIso(),
      };
      members.set(member.id, member);
      return clone(member);
    },

    async listProjectMembers(projectId) {
      const list: ProjectMember[] = [];
      for (const member of members.values()) {
        if (member.projectId === projectId) list.push(clone(member));
      }
      return list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    },

    async removeProjectMember(memberId, projectId) {
      const member = members.get(memberId);
      if (!member || member.projectId !== projectId) return false;
      members.delete(memberId);
      return true;
    },

    async getMembership(projectId, userId) {
      for (const member of members.values()) {
        if (member.projectId === projectId && member.userId === userId) return clone(member);
      }
      return null;
    },

    // --- project share links (public, read-only) --------------------
    async createShareLink(projectId, input) {
      const link: StoredShareLink = {
        id: generateId("shl"),
        projectId,
        tokenHash: input.tokenHash,
        prefix: input.prefix,
        ...(input.label ? { label: input.label } : {}),
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
        createdAt: nowIso(),
      };
      shareLinks.set(link.id, link);
      shareLinksByHash.set(link.tokenHash, link.id);
      const { tokenHash, ...publicLink } = link;
      void tokenHash;
      return clone(publicLink);
    },

    async listShareLinks(projectId) {
      const list: ProjectShareLink[] = [];
      for (const link of shareLinks.values()) {
        if (link.projectId !== projectId) continue;
        const { tokenHash, ...publicLink } = link;
        void tokenHash;
        list.push(clone(publicLink));
      }
      return list.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    },

    async deleteShareLink(id, projectId) {
      const link = shareLinks.get(id);
      if (!link || link.projectId !== projectId) return false;
      shareLinks.delete(id);
      shareLinksByHash.delete(link.tokenHash);
      return true;
    },

    async resolveProjectByShareTokenHash(tokenHash) {
      const id = shareLinksByHash.get(tokenHash);
      if (!id) return null;
      const link = shareLinks.get(id);
      if (!link) return null;
      if (link.expiresAt && Date.parse(link.expiresAt) <= Date.now()) return null;
      link.lastUsedAt = nowIso();
      for (const project of projects.values()) {
        if (project.id === link.projectId) return clone(project);
      }
      return null;
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
        .filter((f) => (query.dateFrom ? f.createdAt >= `${query.dateFrom}T00:00:00.000Z` : true))
        .filter((f) => (query.dateTo ? f.createdAt <= `${query.dateTo}T23:59:59.999Z` : true))
        // SDK clients pass `excludeArchived: true` so old archived pins
        // don't keep rendering on the prototype. An explicit `status` filter
        // wins (caller can still ask for archived items by name).
        .filter((f) =>
          query.excludeArchived && !query.status ? f.status !== "archived" : true
        )
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

      const total = filtered.length;
      const limit = query.limit ?? 20;
      const page = query.page ?? 1;
      const totalPages = Math.ceil(total / limit) || 1;
      const offset = (page - 1) * limit;

      const paginated = filtered.slice(offset, offset + limit);

      return {
        items: paginated.map(clone),
        total,
        limit,
        page,
        totalPages,
      };
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
        ...(input.comment ? { author: { ...input.comment.author } } : {}),
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
