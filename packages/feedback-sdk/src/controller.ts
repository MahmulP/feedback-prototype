import type {
  CreateFeedbackInput,
  Feedback,
  FeedbackAuthor,
  FeedbackStatus,
  FeedbackTransport,
} from "./types.js";
import { computeCoordinates, getViewportInfo } from "./coordinates.js";
import { loadAuthor, saveAuthor } from "./identity.js";
import { Overlay } from "./overlay.js";
import { captureViewport } from "./screenshot.js";
import { findElement, resolveSelector } from "./selector.js";
import { createHttpTransport } from "./transport.js";

export interface InitFeedbackOptions {
  /** Base URL of the API (used when no `transport` is provided). */
  apiUrl?: string;
  /** Per-project ingest key (sent as `x-feedback-key` to the API). Required when using the HTTP transport. */
  apiKey?: string;
  /** Custom transport override. Useful for tests, mocks, or non-HTTP backends. */
  transport?: FeedbackTransport;
  /**
   * Identifier used for client-side caching (author identity per project).
   * Defaults to `apiKey`'s prefix when omitted; safe to leave unset.
   */
  cacheNamespace?: string;
  /** Start with feedback mode enabled. Defaults to `false` (caller toggles via UI). */
  enabled?: boolean;
  /** Override how the page URL is captured. Defaults to `window.location.pathname + search`. */
  getPageUrl?: () => string;
  /**
   * Modifier key used to "select parent" while picking a target.
   * Defaults to "Alt".
   */
  selectParentModifier?: "Alt" | "Shift" | "Meta" | "Control";
  /** Override how the author identity is read. Defaults to a localStorage cache. */
  getAuthor?: () => FeedbackAuthor | null;
  /** Override how the author identity is persisted after a successful submit. */
  setAuthor?: (author: FeedbackAuthor) => void;
  /** Capture a screenshot when a new pin is created. Defaults to `true`. */
  captureScreenshots?: boolean;
  /** Override the screenshot capture function. Returns null to skip silently. */
  captureScreenshot?: () => Promise<Blob | null>;
  /** Render the floating launcher widget. Defaults to `true`. */
  showLauncher?: boolean;
  /** Initial pin visibility. Defaults to `true`. */
  pinsVisible?: boolean;
  /** Called when a pin is clicked in display mode. Use to render a thread popover. */
  onPinClick?: (feedback: Feedback) => void;
  /** Called after a new pin is created. */
  onPinCreate?: (feedback: Feedback) => void;
  /** Called when an error happens during a SDK action. */
  onError?: (err: unknown) => void;
}

export interface FeedbackController {
  /** Toggle / set feedback creation mode. */
  setEnabled(enabled: boolean): void;
  /** Read the current enabled state. */
  isEnabled(): boolean;
  /** Show or hide all pins (the floating launcher's eye toggle calls this). */
  setPinsVisible(visible: boolean): void;
  /** Show or hide the floating launcher widget. */
  setLauncherVisible(visible: boolean): void;
  /** Trigger a fresh fetch of feedback for the current project. */
  refresh(): Promise<void>;
  /** Tear down: remove DOM, listeners, and observers. Idempotent. */
  destroy(): void;
}

interface InternalState {
  enabled: boolean;
  hoverTarget: Element | null;
  /** When the user "selects up" with the modifier, this is the locked candidate. */
  candidate: Element | null;
  feedbacks: Feedback[];
  destroyed: boolean;
}

interface PendingPin {
  selector: string;
  coordinates: ReturnType<typeof computeCoordinates>;
  pageX: number;
  pageY: number;
}

export function initFeedback(options: InitFeedbackOptions): FeedbackController {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return ssrNoopController();
  }

  const transport: FeedbackTransport =
    options.transport ??
    (() => {
      if (!options.apiUrl) {
        throw new Error("initFeedback: provide either `transport` or `apiUrl`");
      }
      if (!options.apiKey) {
        throw new Error("initFeedback: `apiKey` is required when using the default HTTP transport");
      }
      return createHttpTransport({ apiUrl: options.apiUrl, apiKey: options.apiKey });
    })();

  const namespace =
    options.cacheNamespace ?? (options.apiKey ? options.apiKey.slice(0, 12) : "default");

  const overlay = new Overlay();

  const state: InternalState = {
    enabled: !!options.enabled,
    hoverTarget: null,
    candidate: null,
    feedbacks: [],
    destroyed: false,
  };

  let pendingPin: PendingPin | null = null;
  let activeThreadId: string | null = null;

  const getPageUrl =
    options.getPageUrl ?? (() => window.location.pathname + window.location.search);
  const modKey = options.selectParentModifier ?? "Alt";
  const getAuthor = options.getAuthor ?? (() => loadAuthor(namespace));
  const setAuthor =
    options.setAuthor ??
    ((author: FeedbackAuthor) => {
      saveAuthor(namespace, author);
    });
  const wantsScreenshots = options.captureScreenshots !== false;
  const captureFn = options.captureScreenshot ?? (() => captureViewport());

  function isModifierActive(e: MouseEvent | KeyboardEvent): boolean {
    switch (modKey) {
      case "Alt":
        return e.altKey;
      case "Shift":
        return e.shiftKey;
      case "Meta":
        return e.metaKey;
      case "Control":
        return e.ctrlKey;
    }
  }

  function reportError(err: unknown) {
    if (options.onError) {
      try {
        options.onError(err);
      } catch {
        /* swallow */
      }
    } else if (typeof console !== "undefined") {
      console.error("[feedback-sdk]", err);
    }
  }

  // ---------- Event handlers ----------

  function onMouseMove(e: MouseEvent) {
    if (!state.enabled) return;
    if (overlay.ownsEvent(e)) return;
    if (pendingPin || activeThreadId) return; // freeze hover while a popover is open

    const target = elementAtFiltered(e.clientX, e.clientY, overlay);
    if (!target) {
      state.hoverTarget = null;
      overlay.hideHighlight();
      overlay.hideHud();
      return;
    }
    state.hoverTarget = target;
    state.candidate = target;
    overlay.showHighlight(target);
    overlay.showHud(target);
  }

  function onClick(e: MouseEvent) {
    // Always allow clicks inside the popover to behave normally.
    if (overlay.popoverOwnsEvent(e)) return;
    if (!state.enabled) return;
    if (overlay.ownsEvent(e)) return; // SDK's own UI (pins handle their own click)

    if (isModifierActive(e)) {
      const next = state.candidate?.parentElement ?? null;
      if (next && next !== document.body && next !== document.documentElement) {
        state.candidate = next;
        overlay.showHighlight(next);
        overlay.showHud(next);
      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const target = state.candidate ?? state.hoverTarget;
    if (!target) return;

    e.preventDefault();
    e.stopPropagation();

    openComposerAt(target, e.clientX, e.clientY);
  }

  function onKeyDown(e: KeyboardEvent) {
    // Global shortcut: Ctrl/⌘+Shift+F toggles feedback mode + reveals launcher.
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "F" || e.key === "f")) {
      e.preventDefault();
      e.stopPropagation();
      if (!launcherState.launcherVisible) {
        launcherState.launcherVisible = true;
        syncLauncher();
      }
      publicSetEnabled(!state.enabled);
      return;
    }
    if (e.key === "Escape") {
      if (pendingPin || activeThreadId) {
        cancelComposer();
        closeThread();
        return;
      }
      if (state.enabled) {
        state.candidate = null;
        state.hoverTarget = null;
        overlay.hideHighlight();
        overlay.hideHud();
      }
    }
  }

  function onWindowReposition() {
    overlay.reposition();
  }

  // ---------- Composer & thread ----------

  function openComposerAt(target: Element, clientX: number, clientY: number) {
    const selector = resolveSelector(target);
    const coordinates = computeCoordinates(target, clientX, clientY);
    pendingPin = {
      selector,
      coordinates,
      pageX: clientX + window.scrollX,
      pageY: clientY + window.scrollY,
    };

    overlay.hideHighlight();
    overlay.hideHud();

    // Kick off screenshot capture in the background while the user types.
    // We hide the overlay's host inside captureViewport, so it never appears
    // in the resulting image even though the popover renders during typing.
    let screenshotPromise: Promise<Blob | null> | null = null;
    if (wantsScreenshots) {
      screenshotPromise = captureFn().catch(() => null);
    }

    overlay.popoverManager().showComposer(
      { pageX: pendingPin.pageX, pageY: pendingPin.pageY },
      {
        initialAuthor: getAuthor(),
        onSubmit: async (body, author) => {
          const pin = pendingPin;
          if (!pin) return;
          try {
            const fb = await createPin(pin, { author, body });
            setAuthor(author);
            options.onPinCreate?.(fb);
            pendingPin = null;
            overlay.popoverManager().hide();

            if (screenshotPromise && transport.uploadScreenshot) {
              void screenshotPromise
                .then(async (blob) => {
                  if (!blob) return;
                  const updated = await transport.uploadScreenshot!(fb.id, blob);
                  replaceFeedback(updated);
                })
                .catch((err) => reportError(err));
            }
          } catch (err) {
            reportError(err);
          }
        },
        onCancel: () => cancelComposer(),
      }
    );
  }

  function cancelComposer() {
    if (!pendingPin) return;
    pendingPin = null;
    overlay.popoverManager().hide();
  }

  function openThread(fb: Feedback) {
    activeThreadId = fb.id;
    const anchor = computeThreadAnchor(fb);
    overlay.popoverManager().showThread(fb, anchor, {
      initialAuthor: getAuthor(),
      onReply: async (body, author) => {
        try {
          const updated = await transport.reply(fb.id, { author, body });
          setAuthor(author);
          replaceFeedback(updated);
          // Re-render the thread with the new comment.
          overlay.popoverManager().hide();
          activeThreadId = null;
          openThread(updated);
        } catch (err) {
          reportError(err);
        }
      },
      onStatus: async (status: FeedbackStatus) => {
        try {
          const updated = await transport.setStatus(fb.id, status);
          replaceFeedback(updated);
          overlay.popoverManager().hide();
          activeThreadId = null;
          openThread(updated);
        } catch (err) {
          reportError(err);
        }
      },
      onClose: () => closeThread(),
    });
  }

  function closeThread() {
    if (!activeThreadId) return;
    activeThreadId = null;
    overlay.popoverManager().hide();
  }

  function computeThreadAnchor(fb: Feedback): { pageX: number; pageY: number } {
    const target = findElement(fb.selector);
    if (target) {
      const rect = target.getBoundingClientRect();
      return {
        pageX: rect.left + window.scrollX + rect.width * fb.coordinates.xPercent,
        pageY: rect.top + window.scrollY + rect.height * fb.coordinates.yPercent,
      };
    }
    return { pageX: fb.coordinates.xPx, pageY: fb.coordinates.yPx };
  }

  // ---------- Pin lifecycle ----------

  async function createPin(
    pin: PendingPin,
    comment: { author: FeedbackAuthor; body: string }
  ): Promise<Feedback> {
    const viewport = getViewportInfo();
    const pageUrl = getPageUrl();

    const input: CreateFeedbackInput = {
      projectId: "", // server resolves from API key — kept here only to satisfy the type
      pageUrl,
      selector: pin.selector,
      coordinates: pin.coordinates,
      viewport,
      comment,
    };

    const fb = await transport.create(input);
    state.feedbacks = [...state.feedbacks, fb];
    overlay.renderPins(state.feedbacks, openThread, onPinDragEnd);
    return fb;
  }

  function replaceFeedback(updated: Feedback) {
    state.feedbacks = state.feedbacks.map((f) => (f.id === updated.id ? updated : f));
    overlay.renderPins(state.feedbacks, openThread, onPinDragEnd);
  }

  async function refresh(): Promise<void> {
    try {
      // The transport's list() filters server-side by the API key's project,
      // so we just pass an empty query and trust the response.
      const result = await transport.list({ projectId: "" });
      state.feedbacks = result.items;
      overlay.renderPins(state.feedbacks, openThread, onPinDragEnd);
    } catch (err) {
      reportError(err);
    }
  }

  async function onPinDragEnd(
    id: string,
    next: { xPercent: number; yPercent: number; xPx: number; yPx: number }
  ): Promise<void> {
    // Optimistic update so the pin doesn't snap back during the request.
    const previous = state.feedbacks.find((f) => f.id === id);
    if (!previous) return;
    const optimistic: Feedback = {
      ...previous,
      coordinates: { ...previous.coordinates, ...next },
      updatedAt: new Date().toISOString(),
    };
    replaceFeedback(optimistic);

    if (!transport.move) return;
    try {
      const persisted = await transport.move(id, optimistic.coordinates);
      replaceFeedback(persisted);
    } catch (err) {
      // Roll back on failure so the UI doesn't drift from the server.
      replaceFeedback(previous);
      reportError(err);
    }
  }

  // ---------- Wire up listeners ----------

  document.addEventListener("mousemove", onMouseMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("scroll", onWindowReposition, true);
  window.addEventListener("resize", onWindowReposition);

  void refresh();
  overlay.setEnabledStyles(state.enabled);

  // ---------- Floating launcher ----------
  const wantsLauncher = options.showLauncher !== false;
  const launcherState = {
    pinsVisible: options.pinsVisible !== false,
    launcherVisible: true,
  };
  overlay.setPinsVisible(launcherState.pinsVisible);

  function syncLauncher(): void {
    launcher?.setEnabled(state.enabled);
    launcher?.setPinsVisible(launcherState.pinsVisible);
    launcher?.setLauncherVisible(launcherState.launcherVisible);
  }

  const launcher = wantsLauncher
    ? overlay.installLauncher({
        onToggleFeedback: () => {
          publicSetEnabled(!state.enabled);
        },
        onTogglePins: () => {
          publicSetPinsVisible(!launcherState.pinsVisible);
        },
        onHideLauncher: () => {
          publicSetLauncherVisible(!launcherState.launcherVisible);
        },
      })
    : null;
  syncLauncher();

  function publicSetEnabled(enabled: boolean) {
    if (state.destroyed) return;
    state.enabled = enabled;
    overlay.setEnabledStyles(enabled);
    if (!enabled) cancelComposer();
    syncLauncher();
  }
  function publicSetPinsVisible(visible: boolean) {
    if (state.destroyed) return;
    launcherState.pinsVisible = visible;
    overlay.setPinsVisible(visible);
    syncLauncher();
  }
  function publicSetLauncherVisible(visible: boolean) {
    if (state.destroyed) return;
    launcherState.launcherVisible = visible;
    syncLauncher();
  }

  return {
    setEnabled: publicSetEnabled,
    isEnabled() {
      return state.enabled;
    },
    setPinsVisible: publicSetPinsVisible,
    setLauncherVisible: publicSetLauncherVisible,
    async refresh() {
      if (state.destroyed) return;
      await refresh();
    },
    destroy() {
      if (state.destroyed) return;
      state.destroyed = true;
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onWindowReposition, true);
      window.removeEventListener("resize", onWindowReposition);
      overlay.destroy();
    },
  };
}

function elementAtFiltered(x: number, y: number, overlay: Overlay): Element | null {
  const stack = document.elementsFromPoint(x, y);
  for (const node of stack) {
    if (overlay.ownsEvent({ composedPath: () => [node] } as unknown as Event)) continue;
    if (node === document.documentElement || node === document.body) continue;
    return node;
  }
  return null;
}

function ssrNoopController(): FeedbackController {
  return {
    setEnabled() {},
    isEnabled() {
      return false;
    },
    setPinsVisible() {},
    setLauncherVisible() {},
    async refresh() {},
    destroy() {},
  };
}
