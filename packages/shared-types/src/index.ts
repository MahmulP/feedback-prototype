/**
 * Shared wire types for the feedback platform.
 *
 * This package contains *only* types — no runtime code. It is the contract
 * between the SDK, the API, and the dashboard.
 *
 * See `.kiro/steering/feedback-data-model.md` for the canonical description
 * of these shapes and the rules for evolving them.
 */

export type FeedbackStatus = "open" | "resolved" | "archived";

/** Pin coordinates: percentage-based (for re-rendering) and pixel (fallback). */
export interface FeedbackCoordinates {
  /** 0..1, x position relative to the target element's bounding box. */
  xPercent: number;
  /** 0..1, y position relative to the target element's bounding box. */
  yPercent: number;
  /** Absolute x position in page pixels at capture time. */
  xPx: number;
  /** Absolute y position in page pixels at capture time. */
  yPx: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface FeedbackAuthor {
  name: string;
  email?: string;
}

export interface FeedbackComment {
  id: string;
  author: FeedbackAuthor;
  body: string;
  createdAt: string; // ISO-8601
}

/** A pin/feedback record as seen on the wire. */
export interface Feedback {
  id: string;
  projectId: string;
  pageUrl: string;
  selector: string;
  coordinates: FeedbackCoordinates;
  viewport: ViewportInfo;
  /** Storage key returned by the API after upload. Absent until a screenshot is uploaded. */
  screenshotKey?: string;
  status: FeedbackStatus;
  thread: FeedbackComment[];
  createdAt: string;
  updatedAt: string;
}

/** Payload the SDK sends to create a new pin. The server fills in id/timestamps/status/thread. */
export interface CreateFeedbackInput {
  projectId: string;
  pageUrl: string;
  selector: string;
  coordinates: FeedbackCoordinates;
  viewport: ViewportInfo;
  /** Optional first comment posted alongside the pin. */
  comment?: {
    author: FeedbackAuthor;
    body: string;
  };
}

export interface ListFeedbackQuery {
  projectId: string;
  pageUrl?: string;
  status?: FeedbackStatus;
  /**
   * When true, archived items are filtered out unless an explicit `status`
   * filter overrides it. Useful for SDK-side rendering where archived pins
   * shouldn't appear on the prototype anymore. Dashboards typically leave
   * this false so reviewers can manage archived items.
   */
  excludeArchived?: boolean;
}

export interface ListFeedbackResult {
  items: Feedback[];
}

/**
 * Transport contract used by the SDK to talk to "something that persists feedback".
 * v1 ships with an HTTP transport and an in-memory transport for local dev.
 */
export interface FeedbackTransport {
  list(query: ListFeedbackQuery): Promise<ListFeedbackResult>;
  create(input: CreateFeedbackInput): Promise<Feedback>;
  reply(feedbackId: string, comment: { author: FeedbackAuthor; body: string }): Promise<Feedback>;
  setStatus(feedbackId: string, status: FeedbackStatus): Promise<Feedback>;
  /** Move a pin: persist new percent + pixel coordinates after a drag. */
  move?(feedbackId: string, coordinates: FeedbackCoordinates): Promise<Feedback>;
  /** Upload a screenshot blob for an already-created feedback. Returns the updated record. */
  uploadScreenshot?(feedbackId: string, blob: Blob): Promise<Feedback>;
}

// ---------------- Users & projects ----------------

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Project {
  id: string;
  ownerId: string;
  /** Slug used as the projectId on every Feedback row. */
  slug: string;
  name: string;
  description?: string;
  /** Comma-separated list of origins allowed to send feedback for this project. */
  allowedOrigins: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * A user's relationship to a project.
 *
 * `owner`  — created the project; full control (settings, keys, sharing, delete).
 * `editor` — shared collaborator who can view AND triage feedback (status
 *   changes + replies), but cannot manage keys, settings, sharing, or delete.
 * `viewer` — shared collaborator with read-only access: can see feedback but
 *   cannot change status or reply.
 */
export type ProjectRole = "owner" | "editor" | "viewer";

/** Roles that can be assigned when sharing a project (owner is implicit). */
export type SharedRole = Exclude<ProjectRole, "owner">;

/** Project view for the dashboard, with feedback counters + the caller's role. */
export interface ProjectSummary extends Project {
  totalFeedback: number;
  openFeedback: number;
  /** The requesting user's role on this project. */
  role: ProjectRole;
}

/** A single project + the requesting user's role. Returned by the detail endpoint. */
export interface ProjectWithRole extends Project {
  role: ProjectRole;
}

/**
 * A shared collaborator on a project. Stored rows have role `editor` or
 * `viewer` (the owner is implicit, recorded on the project itself, not as a
 * member row). `email`/`name` are denormalized from the user for display.
 */
export interface ProjectMember {
  id: string;
  /** The project's `prj_` id (not the slug). */
  projectId: string;
  userId: string;
  email: string;
  name: string;
  role: ProjectRole;
  createdAt: string;
}

export interface AddProjectMemberInput {
  /** Email of an existing registered user to share the project with. */
  email: string;
  /** Access level to grant. Defaults to `viewer`. */
  role?: SharedRole;
}

/** Returned exactly once when a key is created or rotated. */
export interface ProjectApiKeyIssued {
  id: string;
  projectId: string;
  /** The plaintext key. Shown only at creation; the API stores a hash. */
  key: string;
  createdAt: string;
}

export interface ProjectApiKeyMetadata {
  id: string;
  projectId: string;
  /** First few characters of the key for UI display. The full key is never re-shown. */
  prefix: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface CreateProjectInput {
  slug: string;
  name: string;
  description?: string;
  allowedOrigins?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  allowedOrigins?: string[];
}

export interface SignupInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
