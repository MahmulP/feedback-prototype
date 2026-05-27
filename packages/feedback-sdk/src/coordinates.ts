import type { FeedbackCoordinates, ViewportInfo } from "./types.js";

/**
 * Compute pin coordinates for a click on a target element.
 *
 * - xPercent / yPercent are relative to the target's bounding box (clamped 0..1),
 *   used to re-render the pin after layout changes.
 * - xPx / yPx are absolute page coordinates, used as the orphaned-pin fallback.
 */
export function computeCoordinates(
  target: Element,
  clientX: number,
  clientY: number
): FeedbackCoordinates {
  const rect = target.getBoundingClientRect();
  const width = rect.width || 1;
  const height = rect.height || 1;

  const xPercent = clamp01((clientX - rect.left) / width);
  const yPercent = clamp01((clientY - rect.top) / height);

  const xPx = Math.round(clientX + window.scrollX);
  const yPx = Math.round(clientY + window.scrollY);

  return { xPercent, yPercent, xPx, yPx };
}

export function getViewportInfo(): ViewportInfo {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

/**
 * Project stored coordinates back onto a (possibly resolved) target element.
 * If `target` is null (orphaned), fall back to absolute page pixels.
 *
 * Returns coordinates in the **page** coordinate space (account for scroll separately
 * when positioning fixed-overlay elements).
 */
export function projectCoordinates(
  target: Element | null,
  coords: FeedbackCoordinates
): { x: number; y: number; orphaned: boolean } {
  if (target) {
    const rect = target.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX + rect.width * coords.xPercent,
      y: rect.top + window.scrollY + rect.height * coords.yPercent,
      orphaned: false,
    };
  }
  return { x: coords.xPx, y: coords.yPx, orphaned: true };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
