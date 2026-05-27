/**
 * Public entry â€” framework-agnostic core.
 *
 *   import { initFeedback } from '@mahmulp/feedback-sdk'
 *
 * Svelte users may prefer the adapter at `@mahmulp/feedback-sdk/svelte`.
 * For local development without a backend, see `@mahmulp/feedback-sdk/mock`.
 */

import { initFeedback as _initFeedback } from "./controller.js";
import type { FeedbackController, InitFeedbackOptions } from "./controller.js";

export { initFeedback } from "./controller.js";
export type { FeedbackController, InitFeedbackOptions } from "./controller.js";

export { resolveSelector, findElement } from "./selector.js";
export { computeCoordinates, projectCoordinates, getViewportInfo } from "./coordinates.js";
export { createHttpTransport } from "./transport.js";
export type { HttpTransportOptions } from "./transport.js";
export { captureViewport } from "./screenshot.js";
export type { CaptureOptions } from "./screenshot.js";

// Convenience: auto-init from a single global controller for users who want
// `setFeedbackEnabled` / `destroyFeedback` style ergonomics. The first call
// to `initFeedback` is captured here.

let _globalController: FeedbackController | null = null;

/** @internal */
export function _setGlobalController(c: FeedbackController | null) {
  _globalController = c;
}

export function setFeedbackEnabled(enabled: boolean) {
  _globalController?.setEnabled(enabled);
}

export function destroyFeedback() {
  _globalController?.destroy();
  _globalController = null;
}

/**
 * Wrapper that captures the most recently created controller, so the
 * `setFeedbackEnabled` / `destroyFeedback` shortcuts work for the common case.
 */
export function initFeedbackGlobal(options: InitFeedbackOptions): FeedbackController {
  const ctrl = _initFeedback(options);
  _globalController = ctrl;
  return ctrl;
}

// Re-export shared wire types for SDK consumers that don't want to import from
// shared-types separately.
export type {
  CreateFeedbackInput,
  Feedback,
  FeedbackAuthor,
  FeedbackComment,
  FeedbackCoordinates,
  FeedbackStatus,
  FeedbackTransport,
  ListFeedbackQuery,
  ListFeedbackResult,
  ViewportInfo,
} from "@mahmulp/shared-types";
