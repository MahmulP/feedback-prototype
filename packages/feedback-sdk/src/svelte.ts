/**
 * Svelte adapter â€” thin lifecycle wrapper around the framework-agnostic core.
 *
 *   import { feedback, feedbackEnabled } from '@mahmulp/feedback-sdk/svelte'
 *
 * Usage:
 *
 *   <script lang="ts">
 *     import { feedback, feedbackEnabled } from '@mahmulp/feedback-sdk/svelte'
 *     const enabled = feedbackEnabled()
 *   </script>
 *
 *   <div use:feedback={{ apiUrl: '/api', apiKey: 'mp_…' }}>
 *     <slot />
 *   </div>
 *
 *   <button on:click={() => enabled.toggle()}>
 *     {$enabled ? 'Stop' : 'Start'} feedback
 *   </button>
 */

import { initFeedback } from "./controller.js";
import type { FeedbackController, InitFeedbackOptions } from "./controller.js";

export type FeedbackActionParams = InitFeedbackOptions;

export interface FeedbackAction {
  destroy(): void;
  update(params: FeedbackActionParams): void;
}

/**
 * Svelte action: `use:feedback={{ apiUrl, apiKey }}`.
 *
 * The action is a no-op during SSR (`initFeedback` already returns an SSR-safe
 * controller, but we still skip it to avoid even constructing the host).
 */
export function feedback(node: HTMLElement, params: FeedbackActionParams): FeedbackAction {
  let controller: FeedbackController | null = null;
  let lastParams = params;

  if (typeof window !== "undefined") {
    controller = initFeedback(params);
    enabledStore.attach(controller);
  }

  return {
    update(next: FeedbackActionParams) {
      // If the apiKey / apiUrl meaningfully change, restart.
      const restart =
        next.apiKey !== lastParams.apiKey ||
        next.apiUrl !== lastParams.apiUrl ||
        next.transport !== lastParams.transport;
      lastParams = next;
      if (restart && controller) {
        controller.destroy();
        enabledStore.detach();
        if (typeof window !== "undefined") {
          controller = initFeedback(next);
          enabledStore.attach(controller);
        }
      }
    },
    destroy() {
      controller?.destroy();
      controller = null;
      enabledStore.detach();
      // Reference node so eslint and friends don't complain about unused params.
      void node;
    },
  };
}

// ---------- enabled store ----------

interface EnabledStoreApi {
  subscribe(run: (value: boolean) => void): () => void;
  set(value: boolean): void;
  toggle(): void;
}

interface InternalStore extends EnabledStoreApi {
  attach(c: FeedbackController): void;
  detach(): void;
}

function createInternalStore(): InternalStore {
  const subs = new Set<(value: boolean) => void>();
  let value = false;
  let attached: FeedbackController | null = null;

  function emit() {
    for (const s of subs) s(value);
  }

  return {
    subscribe(run) {
      subs.add(run);
      run(value);
      return () => subs.delete(run);
    },
    set(next: boolean) {
      value = next;
      attached?.setEnabled(next);
      emit();
    },
    toggle() {
      this.set(!value);
    },
    attach(c) {
      attached = c;
      // Sync from the controller's initial state.
      value = c.isEnabled();
      emit();
    },
    detach() {
      attached = null;
      value = false;
      emit();
    },
  };
}

const enabledStore = createInternalStore();

/**
 * Returns a writable-ish store of the "feedback mode" flag.
 *
 *   const enabled = feedbackEnabled()
 *   $: console.log($enabled)
 *   enabled.toggle()
 */
export function feedbackEnabled(): EnabledStoreApi {
  return {
    subscribe: enabledStore.subscribe.bind(enabledStore),
    set: enabledStore.set.bind(enabledStore),
    toggle: enabledStore.toggle.bind(enabledStore),
  };
}

// Re-exports useful for typing in SvelteKit.
export type { FeedbackController, InitFeedbackOptions } from "./controller.js";
export type {
  CreateFeedbackInput,
  Feedback,
  FeedbackStatus,
  FeedbackTransport,
} from "@mahmulp/shared-types";
