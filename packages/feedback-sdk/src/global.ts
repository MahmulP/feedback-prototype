/**
 * IIFE bundle entry. Exposes `window.FeedbackSDK = { initFeedback, ... }`.
 */

export { initFeedback, initFeedbackGlobal, setFeedbackEnabled, destroyFeedback } from "./index.js";
export { resolveSelector, findElement } from "./selector.js";
export { createHttpTransport } from "./transport.js";
export { captureViewport } from "./screenshot.js";
