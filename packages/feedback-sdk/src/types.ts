/**
 * Wire types shared between the SDK, the API, and the dashboard.
 *
 * NOTE: This file is the SDK's authoritative copy. The same shapes also live
 * in `packages/shared-types/src/index.ts` for the API and dashboard. Keep
 * them in sync when the wire format evolves.
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
  /** The original reporter — author of the first comment captured at creation. */
  author?: FeedbackAuthor;
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
  limit?: number;
  page?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface ListFeedbackResult {
  items: Feedback[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Transport contract used by the SDK to talk to "something that persists feedback".
 * Default HTTP implementation lives in `transport.ts`. The mock transport in `mock.ts`
 * is useful for local demos and tests.
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
