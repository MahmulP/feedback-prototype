---
inclusion: fileMatch
fileMatchPattern: 'packages/feedback-sdk/**'
---

# Feedback SDK Conventions

Apply these rules whenever working inside `packages/feedback-sdk/`.

## Scope: Svelte-first
v1 supports **Svelte / SvelteKit** as the integration target. Documentation, examples, integration tests, and the published quick-start all assume a Svelte consumer.

The implementation, however, is plain TypeScript over the DOM (no Svelte compiler in the core). That means:

- The SDK core does **not** import from `svelte`, `react`, `vue`, or any framework runtime.
- A thin Svelte wrapper layer is published alongside the core for ergonomics.
- React/Vue/vanilla HTML are not promised, supported, or tested in v1. If someone makes the vanilla API work elsewhere, that's a happy accident, not a contract.

## Public API

### Core (vanilla TS)

```ts
import { initFeedback } from '@mahmulp/feedback-sdk'

initFeedback({
  apiUrl: import.meta.env.PUBLIC_FEEDBACK_API,
  projectId: 'prototype-a',
})
```

The core's published surface in v1:
- `initFeedback(options)` â€” installs the overlay and starts syncing.
- `destroyFeedback()` â€” tears everything down (event listeners, DOM, network polling).
- `setFeedbackEnabled(enabled: boolean)` â€” toggles the comment-creation mode.
- Type exports for the public option/result shapes only.

### Svelte wrapper

Exposed under a sub-path so SvelteKit consumers get the ergonomic API and vanilla consumers don't pay for it:

```ts
// In a SvelteKit prototype:
import { FeedbackProvider } from '@mahmulp/feedback-sdk/svelte'
```

```svelte
<script lang="ts">
  import { FeedbackProvider } from '@mahmulp/feedback-sdk/svelte'
</script>

<FeedbackProvider apiUrl={import.meta.env.PUBLIC_FEEDBACK_API} projectId="prototype-a">
  <slot />
</FeedbackProvider>
```

Rules for the wrapper:
- The Svelte component is a thin lifecycle adapter: it calls `initFeedback` in `onMount` and `destroyFeedback` in `onDestroy`. It must not own product logic.
- Re-export only what makes sense in Svelte; do not duplicate the full core surface in the wrapper.
- Optionally expose a Svelte **action** (`use:feedbackTarget={{ id: 'submit-btn' }}`) as a friendly way to attach `data-feedback-id` attributes. Keep it optional.
- The wrapper lists `svelte` as a peer dependency, **not** a regular dependency. The core remains peer-free.

Any new public export (core or Svelte) needs an explicit decision; do not silently widen the API.

## DOM target selection (interaction model)
When feedback mode is enabled:

- **Hover** outlines the element under the cursor with an overlay-rendered ring; the prototype's own DOM is never mutated.
- **Click** picks that element as the pin target. The SDK records:
  - the resolved selector (see selector strategy in `feedback-data-model.md`),
  - the click position as percentages of the target's bounding box,
  - the click position as absolute page pixels,
  - the viewport size and `devicePixelRatio`.
- **Alt-click** selects the parent of the current target so the user can pick a coarser element. Show the current candidate's tag + classes in the overlay HUD.
- **Escape** cancels selection.
- The SDK ignores clicks on its own overlay UI (use `event.composedPath()` checks).

Existing pins also render in feedback mode, anchored by selector + percentages, with a fallback to absolute pixels when the selector no longer resolves.

## Screenshot capture
- Screenshots are **captured by default** for every new pin in v1.
- Use `html2canvas` (or an equivalent) loaded via **dynamic import** so the cost only hits prototypes that actually create a pin.
- Capture the **visible viewport**, not the full page, to keep the capture fast and the file small.
- Compress to PNG (or WebP if size matters more than fidelity) before upload. Target â‰¤ 1 MB per shot when possible.
- Hide the SDK's own overlay UI before capture and restore it after, so the screenshot reflects the prototype, not our chrome.
- Upload via `POST /v1/feedback/{id}/screenshot` as multipart form data after the metadata pin has been created.
- Capture is best-effort: a failure must not block creation of the pin itself. Surface the error in the dashboard as "screenshot unavailable".

## Overlay & DOM hygiene
- Mount the overlay into a single host element appended to `document.body`.
- Use a **Shadow DOM** root inside that host to isolate styles from the prototype's CSS.
- Use a sentinel `z-index` only inside the overlay's own stacking context; never set `z-index: 99999999` on plain DOM nodes.
- Clean up *every* event listener, observer, and DOM node in `destroyFeedback()`. The SDK must be safe to install and uninstall repeatedly.
- Avoid global side effects on import. All side effects start at `initFeedback()` (or the Svelte component's `onMount`).
- SvelteKit-specific: the SDK runs in the browser only. Guard initialization with `if (typeof window === 'undefined') return;` so SSR doesn't crash.

## Performance & footprint
- Target a gzipped bundle under ~30 KB for the core. Heavier optional deps (`html2canvas`, `interact.js`) must be **dynamically imported** only when first needed (creating a pin, dragging a pin).
- The Svelte wrapper adds at most a few KB on top of the core.
- No polling tighter than 5 seconds. Prefer fetch-on-toggle and `visibilitychange`-based syncs until websockets land.
- Don't read layout in hot paths without batching (group `getBoundingClientRect` reads, then writes).

## Selector strategy & positioning
Follow the rules in `feedback-data-model.md` (selector priority, percentage-based positioning, orphaned-pin handling, viewport metadata). The SDK is the producer of these payloads â€” it must round-trip its own output without drift.

## Browser support
- Modern evergreen browsers (last 2 versions of Chrome, Edge, Firefox, Safari).
- No IE, no transpile-down to ES5. Target ES2020.

## Distribution
- Build with `tsup`, emitting:
  - `dist/index.mjs` (ESM)
  - `dist/index.cjs` (CJS)
  - `dist/index.d.ts` (types)
  - `dist/index.global.js` (IIFE for CDN `<script>` usage)
- The Svelte wrapper builds separately to `dist/svelte/index.mjs` (+ `.d.ts`) and is exposed via the `package.json` `exports` map under the `./svelte` sub-path.
- The `package.json` `exports` map must map both ESM and CJS correctly for the core, plus the `./svelte` entry.
- `sideEffects: false` in `package.json` so bundlers can tree-shake.
- The Svelte wrapper declares `svelte` as a `peerDependency` (not `dependencies`).

## Testing
- Use `vitest` with `happy-dom` or `jsdom` for DOM-touching tests of the core.
- Use `@testing-library/svelte` (or Vitest's built-in Svelte support) for the Svelte wrapper.
- Selector-resolution and positioning logic must have unit tests that cover the orphaned-pin case.
- Screenshot capture is mocked in unit tests; the real capture path is exercised by an opt-in integration test that runs in a real browser (Playwright) when needed.
- A SvelteKit example app under `packages/feedback-sdk/examples/sveltekit/` serves as both documentation and the integration smoke test.
- When invoking tests from automation, always use `vitest --run`.
