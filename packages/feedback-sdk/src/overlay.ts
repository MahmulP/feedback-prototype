import type { Feedback } from "./types.js";
import { findElement } from "./selector.js";
import { projectCoordinates } from "./coordinates.js";
import { LauncherManager, type LauncherCallbacks } from "./launcher.js";
import { PopoverManager } from "./popover.js";

/**
 * Owns the Shadow DOM host that holds the SDK's UI:
 *   - hover highlight ring
 *   - selection HUD (tag + classes of current candidate)
 *   - rendered pins for existing feedback
 *   - composer / thread popover layer
 *
 * Everything is rendered inside a Shadow Root attached to a single host
 * appended to <body>, so prototype CSS can't leak in or out.
 */

const HOST_ATTR = "data-mahmulp-feedback-host";

const OVERLAY_STYLES = `
:host { all: initial; }

.layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.highlight {
  position: fixed;
  border: 2px solid #1F5132;
  background: rgba(31, 81, 50, 0.08);
  border-radius: 4px;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.6) inset;
  transition: top 60ms linear, left 60ms linear, width 60ms linear, height 60ms linear;
  display: none;
  pointer-events: none;
  z-index: 1;
}

.hud {
  position: fixed;
  padding: 6px 10px;
  background: #1F5132;
  color: #F5FFF8;
  font: 500 12px/1.2 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  border-radius: 4px;
  pointer-events: none;
  display: none;
  z-index: 2;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pin {
  position: fixed;
  width: 28px;
  height: 28px;
  margin-left: -14px;
  margin-top: -28px;
  background: #1F5132;
  color: #F5FFF8;
  border: 2px solid #F5FFF8;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  font: 600 11px/1 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  transition: transform 80ms ease;
  z-index: 3;
}
.pin:hover { transform: rotate(-45deg) scale(1.08); }
.pin > span { transform: rotate(45deg); }
.pin.orphaned { opacity: 0.55; filter: grayscale(0.4); }
.pin.resolved { background: #2F7A4D; }
.pin.archived { background: #6B7280; }
.pin.dragging { cursor: grabbing; transform: rotate(-45deg) scale(1.18); }

.pinLayer.hidden { display: none; }

/* ---------- Floating launcher ---------- */
.launcher {
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.96);
  color: #1F5132;
  border: 1px solid rgba(31, 81, 50, 0.18);
  border-radius: 999px;
  box-shadow: 0 12px 24px -10px rgba(15, 35, 24, 0.32),
              0 4px 8px -2px rgba(15, 35, 24, 0.16);
  pointer-events: auto;
  z-index: 5;
  font: 600 12px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  user-select: none;
  transition: opacity 120ms ease, transform 120ms ease;
}
.launcher.hidden {
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
}
.launcher-btn {
  appearance: none;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms ease;
}
.launcher-btn:hover { background: rgba(31, 81, 50, 0.08); }
.launcher-btn:focus-visible {
  outline: 2px solid #1F5132;
  outline-offset: 2px;
}
.launcher-btn svg { width: 18px; height: 18px; pointer-events: none; }
.launcher-btn.primary {
  background: #1F5132;
  color: #F5FFF8;
  width: auto;
  padding: 0 14px 0 12px;
  border-radius: 999px;
  gap: 6px;
}
.launcher-btn.primary:hover { background: #265E3B; }
.launcher-btn.primary.active {
  background: #B91C1C;
  color: #FFE8E8;
}
.launcher-btn.primary.active:hover { background: #A11616; }
.launcher-divider {
  width: 1px;
  height: 22px;
  background: rgba(31, 81, 50, 0.14);
}
.launcher-btn.muted { color: #6B7280; }

/* ---------- Re-show launcher pill ---------- */
.launcher-reveal {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: #1F5132;
  color: #F5FFF8;
  border: 0;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  box-shadow: 0 8px 16px -8px rgba(15, 35, 24, 0.4);
  z-index: 5;
}
.launcher-reveal.visible { display: inline-flex; }
.launcher-reveal:hover { background: #265E3B; }
.launcher-reveal svg { width: 18px; height: 18px; }

@media (prefers-color-scheme: dark) {
  .launcher {
    background: #0F1F17;
    color: #B6D8C5;
    border-color: rgba(120, 200, 160, 0.22);
  }
  .launcher-btn.primary { color: #0F1F17; background: #B6D8C5; }
  .launcher-btn.primary:hover { background: #C7E2D2; }
  .launcher-divider { background: rgba(120, 200, 160, 0.22); }
}

.popover-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}

.popover {
  position: fixed;
  width: 320px;
  max-height: min(70vh, 520px);
  display: flex;
  flex-direction: column;
  background: #FFFFFF;
  color: #111827;
  border: 1px solid rgba(31, 81, 50, 0.18);
  border-radius: 10px;
  box-shadow: 0 18px 36px -12px rgba(15, 35, 24, 0.32),
              0 4px 8px -2px rgba(15, 35, 24, 0.16);
  font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  pointer-events: auto;
  overflow: hidden;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #1F5132;
  color: #F5FFF8;
}
.popover-title {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.01em;
  text-transform: capitalize;
}
.popover-close {
  background: transparent;
  color: inherit;
  border: 0;
  font-size: 18px;
  line-height: 1;
  padding: 2px 6px;
  cursor: pointer;
  border-radius: 4px;
}
.popover-close:hover { background: rgba(255,255,255,0.15); }

.popover-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.popover-toolbar {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.popover-thread-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}
.popover-comment {
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 8px 10px;
  background: #F9FAFB;
}
.popover-comment-meta {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 2px;
}
.popover-comment-body { white-space: pre-wrap; word-break: break-word; }
.popover-empty {
  font-size: 12px;
  color: #6B7280;
  font-style: italic;
}

.popover-identity {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.popover-input,
.popover-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #D1D5DB;
  border-radius: 6px;
  font: inherit;
  color: inherit;
  background: #FFFFFF;
  resize: vertical;
}
.popover-input:focus,
.popover-textarea:focus {
  outline: none;
  border-color: #1F5132;
  box-shadow: 0 0 0 3px rgba(31, 81, 50, 0.15);
}

.popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  font: 600 13px/1 inherit;
  cursor: pointer;
}
.btn[disabled] { opacity: 0.6; cursor: not-allowed; }
.btn-primary {
  background: #1F5132;
  color: #F5FFF8;
}
.btn-primary:hover { background: #295F3D; }
.btn-ghost {
  background: transparent;
  color: #1F5132;
  border-color: rgba(31, 81, 50, 0.3);
}
.btn-ghost:hover { background: rgba(31, 81, 50, 0.05); }
.btn-toolbar {
  background: rgba(31, 81, 50, 0.08);
  color: #1F5132;
  border-color: rgba(31, 81, 50, 0.18);
  font-weight: 500;
  font-size: 12px;
  padding: 5px 10px;
}
.btn-toolbar:hover { background: rgba(31, 81, 50, 0.16); }

@media (prefers-color-scheme: dark) {
  .popover {
    background: #0F1F17;
    color: #E5F2EB;
    border-color: rgba(120, 200, 160, 0.22);
  }
  .popover-comment {
    background: #102A20;
    border-color: rgba(120, 200, 160, 0.18);
  }
  .popover-comment-meta { color: #B6D8C5; }
  .popover-empty { color: #94B3A4; }
  .popover-input,
  .popover-textarea {
    background: #102A20;
    color: inherit;
    border-color: rgba(120, 200, 160, 0.22);
  }
  .btn-ghost { color: #B6D8C5; border-color: rgba(120, 200, 160, 0.3); }
  .btn-ghost:hover { background: rgba(120, 200, 160, 0.08); }
  .btn-toolbar {
    background: rgba(120, 200, 160, 0.12);
    color: #B6D8C5;
    border-color: rgba(120, 200, 160, 0.22);
  }
  .btn-toolbar:hover { background: rgba(120, 200, 160, 0.2); }
}
`;

export interface PinClickHandler {
  (feedback: Feedback): void;
}

export interface PinDragHandler {
  (
    feedbackId: string,
    next: { xPercent: number; yPercent: number; xPx: number; yPx: number }
  ): void;
}

export class Overlay {
  private host: HTMLDivElement;
  private root: ShadowRoot;
  private highlight: HTMLDivElement;
  private hud: HTMLDivElement;
  private pinLayer: HTMLDivElement;
  private popoverLayer: HTMLDivElement;
  private popover: PopoverManager;
  private launcher: LauncherManager | null = null;
  private rafHandle: number | null = null;
  private pendingFeedback: Feedback[] = [];
  private onPinClick: PinClickHandler | null = null;
  private onPinDragEnd: PinDragHandler | null = null;
  private draggingPin: string | null = null;

  constructor() {
    this.host = document.createElement("div");
    this.host.setAttribute(HOST_ATTR, "");
    this.host.style.cssText = [
      "position: fixed",
      "inset: 0",
      "width: 0",
      "height: 0",
      "pointer-events: none",
      "z-index: 2147483647",
    ].join(";");
    document.body.appendChild(this.host);

    this.root = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = OVERLAY_STYLES;
    this.root.appendChild(style);

    this.pinLayer = makeLayer("pinLayer");
    this.highlight = makeLayer("highlight", "div");
    this.hud = makeLayer("hud", "div");
    this.popoverLayer = makeLayer("popover-layer");
    this.root.append(this.pinLayer, this.highlight, this.hud, this.popoverLayer);

    this.popover = new PopoverManager(this.popoverLayer);
  }

  /** Called by the controller when the user enters/leaves feedback mode. */
  setEnabledStyles(enabled: boolean) {
    if (!enabled) {
      this.hideHighlight();
      this.hideHud();
    }
  }

  showHighlight(target: Element) {
    const rect = target.getBoundingClientRect();
    this.highlight.style.display = "block";
    this.highlight.style.left = `${rect.left}px`;
    this.highlight.style.top = `${rect.top}px`;
    this.highlight.style.width = `${rect.width}px`;
    this.highlight.style.height = `${rect.height}px`;
  }

  hideHighlight() {
    this.highlight.style.display = "none";
  }

  showHud(target: Element) {
    const tag = target.tagName.toLowerCase();
    const cls = (target.getAttribute("class") || "").trim();
    const fid = target.getAttribute("data-feedback-id");
    const label = fid
      ? `${tag} [data-feedback-id="${fid}"]`
      : cls
        ? `${tag}.${cls.split(/\s+/).slice(0, 2).join(".")}`
        : tag;

    const rect = target.getBoundingClientRect();
    this.hud.textContent = label;
    this.hud.style.display = "block";
    const hudHeight = 28;
    const top =
      rect.top - hudHeight - 6 > 0
        ? rect.top - hudHeight - 6
        : Math.min(rect.bottom + 6, window.innerHeight - hudHeight);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 320));
    this.hud.style.top = `${top}px`;
    this.hud.style.left = `${left}px`;
  }

  hideHud() {
    this.hud.style.display = "none";
  }

  /** True if the event originated from the SDK's own UI (so we ignore it). */
  ownsEvent(event: Event): boolean {
    const path = event.composedPath();
    if (path.includes(this.host)) return true;
    if (path.some((n) => n === this.root)) return true;
    if (this.launcher) {
      for (const node of path) {
        if (this.launcher.ownsNode(node as Element | EventTarget)) return true;
      }
    }
    return false;
  }

  /** True if the event originated from the popover specifically. */
  popoverOwnsEvent(event: Event): boolean {
    return this.popover.ownsEvent(event);
  }

  /** Render the given feedback list as pins. */
  renderPins(
    feedbacks: Feedback[],
    onClick: PinClickHandler | null,
    onDragEnd: PinDragHandler | null = null
  ) {
    this.onPinClick = onClick;
    this.onPinDragEnd = onDragEnd;
    this.pendingFeedback = feedbacks;
    this.scheduleRepositionPins();
  }

  /** Re-position pins after layout changes. Called on resize/scroll. */
  reposition() {
    this.scheduleRepositionPins();
    this.popover.reposition();
  }

  popoverManager(): PopoverManager {
    return this.popover;
  }

  /** Wire the floating launcher to controller callbacks. Idempotent. */
  installLauncher(callbacks: LauncherCallbacks): LauncherManager {
    if (this.launcher) return this.launcher;
    this.launcher = new LauncherManager(this.root, callbacks);
    return this.launcher;
  }

  /** Show or hide the pin layer entirely (e.g. via the eye toggle). */
  setPinsVisible(visible: boolean): void {
    this.pinLayer.classList.toggle("hidden", !visible);
  }

  private scheduleRepositionPins() {
    if (this.rafHandle !== null) return;
    this.rafHandle = requestAnimationFrame(() => {
      this.rafHandle = null;
      this.layoutPins();
    });
  }

  private layoutPins() {
    // Diff-based rendering: keep existing pin DOM nodes whenever possible
    // so that interactive state (focus, pointer capture, drag listeners)
    // doesn't get blown away mid-interaction. Rebuilding via
    // `replaceChildren` on every state change caused the "blink + reopen"
    // flicker users saw when replying / changing status.
    const existing = new Map<string, HTMLButtonElement>();
    for (const node of Array.from(this.pinLayer.children) as HTMLButtonElement[]) {
      const id = node.dataset.feedbackId;
      if (id) existing.set(id, node);
    }

    const desiredOrder: HTMLButtonElement[] = [];
    const seen = new Set<string>();

    for (const fb of this.pendingFeedback) {
      seen.add(fb.id);
      const target = findElement(fb.selector);
      const projected = projectCoordinates(target, fb.coordinates);
      const left = `${projected.x - window.scrollX}px`;
      const top = `${projected.y - window.scrollY}px`;

      let pin = existing.get(fb.id);
      if (pin) {
        // Update an existing node in place.
        const classes = ["pin"];
        if (projected.orphaned) classes.push("orphaned");
        if (fb.status === "resolved") classes.push("resolved");
        if (fb.status === "archived") classes.push("archived");
        // Preserve the "dragging" class if a drag is in flight for this pin.
        if (pin.classList.contains("dragging")) classes.push("dragging");
        pin.className = classes.join(" ");
        if (pin.style.left !== left) pin.style.left = left;
        if (pin.style.top !== top) pin.style.top = top;
        const label = pin.firstElementChild as HTMLSpanElement | null;
        const nextLabel = String(fb.thread.length || 1);
        if (label && label.textContent !== nextLabel) label.textContent = nextLabel;
      } else {
        // Brand-new pin: build it from scratch.
        pin = document.createElement("button");
        pin.type = "button";
        const classes = ["pin"];
        if (projected.orphaned) classes.push("orphaned");
        if (fb.status === "resolved") classes.push("resolved");
        if (fb.status === "archived") classes.push("archived");
        pin.className = classes.join(" ");
        pin.dataset.feedbackId = fb.id;
        pin.setAttribute("aria-label", `Feedback ${fb.id}`);
        pin.style.left = left;
        pin.style.top = top;
        const label = document.createElement("span");
        label.textContent = String(fb.thread.length || 1);
        pin.appendChild(label);
        pin.addEventListener("click", (e) => {
          e.stopPropagation();
          // Resolve the click against the *current* pendingFeedback list so
          // updates to status/thread length are reflected on click instead
          // of the stale closure value captured at first render.
          if (this.draggingPin === fb.id) return;
          const fresh = this.pendingFeedback.find((f) => f.id === fb.id) ?? fb;
          this.onPinClick?.(fresh);
        });
        this.attachDragHandlers(pin, fb);
      }
      desiredOrder.push(pin);
    }

    // Remove pins that no longer exist in the feedback list.
    for (const [id, node] of existing) {
      if (!seen.has(id)) node.remove();
    }

    // Make sure DOM order matches desired order. We compare child-by-child
    // and only insert when needed; this keeps the DOM stable for nodes that
    // didn't move.
    for (let i = 0; i < desiredOrder.length; i++) {
      const want = desiredOrder[i]!;
      const have = this.pinLayer.children[i] as HTMLElement | undefined;
      if (have !== want) this.pinLayer.insertBefore(want, have ?? null);
    }
  }

  destroy() {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.popover.hide();
    this.launcher?.destroy();
    this.launcher = null;
    this.host.remove();
  }

  private attachDragHandlers(pin: HTMLButtonElement, fb: Feedback): void {
    let startClientX = 0;
    let startClientY = 0;
    let pointerDownAt = 0;
    let isDragging = false;
    let pointerId: number | null = null;
    let originLeft = 0;
    let originTop = 0;
    const DRAG_THRESHOLD = 4; // pixels before we treat it as a drag

    const onPointerMove = (e: PointerEvent) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      if (!isDragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!isDragging) {
        isDragging = true;
        this.draggingPin = fb.id;
        pin.classList.add("dragging");
      }
      const nextLeft = Math.max(0, Math.min(window.innerWidth, originLeft + dx));
      const nextTop = Math.max(0, Math.min(window.innerHeight, originTop + dy));
      pin.style.left = `${nextLeft}px`;
      pin.style.top = `${nextTop}px`;
    };

    const finish = (e: PointerEvent) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      pin.removeEventListener("pointermove", onPointerMove);
      pin.removeEventListener("pointerup", finish);
      pin.removeEventListener("pointercancel", finish);
      try {
        pin.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      pointerId = null;
      pin.classList.remove("dragging");

      if (!isDragging) return;
      // Re-project from final viewport position back into the pin's selector.
      const target = findElement(fb.selector);
      const rect = pin.getBoundingClientRect();
      // The pin's tail tip sits at center-x, bottom of the bounding box.
      const tipX = rect.left + rect.width / 2;
      const tipY = rect.top + rect.height;
      const next = {
        xPx: Math.round(tipX + window.scrollX),
        yPx: Math.round(tipY + window.scrollY),
        xPercent: 0,
        yPercent: 0,
      };
      if (target) {
        const t = target.getBoundingClientRect();
        next.xPercent = clamp01((tipX - t.left) / (t.width || 1));
        next.yPercent = clamp01((tipY - t.top) / (t.height || 1));
      } else {
        next.xPercent = clamp01(tipX / (window.innerWidth || 1));
        next.yPercent = clamp01(tipY / (window.innerHeight || 1));
      }

      this.onPinDragEnd?.(fb.id, next);

      // Clear the drag flag on the next click tick so the click handler can
      // see it. RAF gives the browser one frame, plenty of time for the
      // synthetic click to fire and bail out.
      const releasedId = fb.id;
      requestAnimationFrame(() => {
        if (this.draggingPin === releasedId) this.draggingPin = null;
      });
      // Make sure the duration check matches a "real click" definition
      // (< 250ms and no movement) so accidental drags don't open the thread.
      pointerDownAt = 0;
      isDragging = false;
    };

    pin.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      pointerId = e.pointerId;
      startClientX = e.clientX;
      startClientY = e.clientY;
      pointerDownAt = Date.now();
      const rect = pin.getBoundingClientRect();
      originLeft = rect.left;
      originTop = rect.top;
      try {
        pin.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      pin.addEventListener("pointermove", onPointerMove);
      pin.addEventListener("pointerup", finish);
      pin.addEventListener("pointercancel", finish);
      // Avoid native drag start interfering on Safari-flavored browsers.
      e.preventDefault();
    });
    void pointerDownAt;
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function makeLayer(className: string, tag: "div" = "div"): HTMLDivElement {
  const el = document.createElement(tag);
  el.className = className;
  if (className === "pinLayer" || className === "popover-layer") {
    el.classList.add("layer");
  }
  return el as HTMLDivElement;
}
