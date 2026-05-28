/**
 * Floating launcher: 3-button pill anchored to the bottom-right corner.
 *
 *   [ Start feedback ] | 👁 show pins | × hide launcher
 *
 * The launcher lives inside the SDK's Shadow DOM, so its CSS is isolated
 * from the prototype. When hidden it leaves a tiny circular re-show button
 * behind so users can bring it back.
 */

export interface LauncherCallbacks {
  onToggleFeedback: () => void;
  onTogglePins: () => void;
  onHideLauncher: () => void;
}

export interface LauncherState {
  enabled: boolean;
  pinsVisible: boolean;
  launcherVisible: boolean;
}

export class LauncherManager {
  private launcherEl: HTMLDivElement;
  private revealEl: HTMLButtonElement;
  private toggleBtn!: HTMLButtonElement;
  private pinBtn!: HTMLButtonElement;
  private state: LauncherState = {
    enabled: false,
    pinsVisible: true,
    // Start collapsed — only the small reveal bubble is visible until the
    // user clicks it. Less visual weight on the prototype out of the box;
    // user opts in by clicking the bubble icon in the bottom-right.
    launcherVisible: false,
  };

  constructor(parent: ShadowRoot, callbacks: LauncherCallbacks) {
    this.launcherEl = document.createElement("div");
    this.launcherEl.className = "launcher";
    this.launcherEl.setAttribute("role", "toolbar");
    this.launcherEl.setAttribute("aria-label", "Feedback controls");

    this.toggleBtn = document.createElement("button");
    this.toggleBtn.type = "button";
    this.toggleBtn.className = "launcher-btn primary";
    this.toggleBtn.setAttribute("aria-pressed", "false");
    this.toggleBtn.addEventListener("click", () => callbacks.onToggleFeedback());

    const divider = document.createElement("span");
    divider.className = "launcher-divider";
    divider.setAttribute("aria-hidden", "true");

    this.pinBtn = document.createElement("button");
    this.pinBtn.type = "button";
    this.pinBtn.className = "launcher-btn";
    this.pinBtn.setAttribute("aria-pressed", "true");
    this.pinBtn.addEventListener("click", () => callbacks.onTogglePins());

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "launcher-btn muted";
    closeBtn.setAttribute("aria-label", "Hide feedback launcher");
    closeBtn.title = "Hide launcher (Ctrl/⌘+Shift+F to reopen)";
    closeBtn.innerHTML = ICON_X;
    closeBtn.addEventListener("click", () => callbacks.onHideLauncher());

    this.launcherEl.append(this.toggleBtn, divider, this.pinBtn, closeBtn);

    this.revealEl = document.createElement("button");
    this.revealEl.type = "button";
    this.revealEl.className = "launcher-reveal";
    this.revealEl.setAttribute("aria-label", "Show feedback launcher");
    this.revealEl.title = "Show feedback launcher";
    this.revealEl.innerHTML = ICON_BUBBLE;
    this.revealEl.addEventListener("click", () => callbacks.onHideLauncher());

    parent.append(this.launcherEl, this.revealEl);
    this.render();
  }

  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
    this.render();
  }

  setPinsVisible(pinsVisible: boolean): void {
    this.state.pinsVisible = pinsVisible;
    this.render();
  }

  setLauncherVisible(launcherVisible: boolean): void {
    this.state.launcherVisible = launcherVisible;
    this.render();
  }

  /** True when an event originated from the launcher's own UI. */
  ownsNode(node: EventTarget | Element | null): boolean {
    if (!node) return false;
    // composedPath() can include `Window`, `Document`, and shadow roots — none
    // of which are valid arguments to `Node.contains`. Guard with `instanceof`
    // so we never throw `parameter 1 is not of type 'Node'`.
    if (typeof Node === "undefined" || !(node instanceof Node)) return false;
    return this.launcherEl.contains(node) || this.revealEl.contains(node);
  }

  destroy(): void {
    this.launcherEl.remove();
    this.revealEl.remove();
  }

  private render(): void {
    const { enabled, pinsVisible, launcherVisible } = this.state;

    this.launcherEl.classList.toggle("hidden", !launcherVisible);
    this.revealEl.classList.toggle("visible", !launcherVisible);

    this.toggleBtn.classList.toggle("active", enabled);
    this.toggleBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
    this.toggleBtn.title = enabled
      ? "Stop feedback mode (Esc)"
      : "Start feedback mode (Ctrl/⌘+Shift+F)";
    this.toggleBtn.innerHTML = enabled
      ? `${ICON_DOT} <span>Stop</span>`
      : `${ICON_PIN} <span>Feedback</span>`;

    this.pinBtn.classList.toggle("muted", !pinsVisible);
    this.pinBtn.setAttribute("aria-pressed", pinsVisible ? "true" : "false");
    this.pinBtn.setAttribute("aria-label", pinsVisible ? "Hide pins" : "Show pins");
    this.pinBtn.title = pinsVisible ? "Hide pins" : "Show pins";
    this.pinBtn.innerHTML = pinsVisible ? ICON_EYE : ICON_EYE_OFF;
  }
}

// ---- Inline SVG icons (16-line each, currentColor stroke) ----
// Keeping them inline avoids a separate asset and stays inside the Shadow DOM.

const ICON_PIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12Z" />
  <circle cx="12" cy="9" r="2.5" />
</svg>`;

const ICON_DOT = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
  <circle cx="12" cy="12" r="6" />
</svg>`;

const ICON_EYE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
  <circle cx="12" cy="12" r="3" />
</svg>`;

const ICON_EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 3l18 18" />
  <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
  <path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.3 17.3 0 0 1-3.6 4.5" />
  <path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7c1.6 0 3-.3 4.2-.8" />
</svg>`;

const ICON_X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M6 6l12 12M18 6L6 18" />
</svg>`;

const ICON_BUBBLE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M21 12a8 8 0 1 1-3.4-6.5" />
  <path d="M21 4v5h-5" />
</svg>`;
