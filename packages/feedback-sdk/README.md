# @mahmulp/feedback-sdk

[![npm](https://img.shields.io/npm/v/@mahmulp/feedback-sdk.svg)](https://www.npmjs.com/package/@mahmulp/feedback-sdk)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@mahmulp/feedback-sdk)](https://bundlephobia.com/package/@mahmulp/feedback-sdk)

Framework-agnostic visual feedback SDK for prototype review. Reviewers pin comments to UI elements; you get back a stable DOM selector, percentage + pixel coordinates, viewport metadata, and an optional screenshot.

Designed for **self-hosted** setups: pair this SDK with a backend (we ship one in the same repo) and own your data.

- Floating launcher widget built in (toggle feedback mode, hide pins, hide launcher)
- Stable DOM selectors that survive layout changes
- Drag-to-move pins with optimistic update
- Optional screenshot capture (via dynamically loaded `html2canvas`)
- Svelte adapter for ergonomic SvelteKit integration
- Works in React, Vue, and plain HTML via the same core API

## Install

```bash
npm  install @mahmulp/feedback-sdk
bun  add     @mahmulp/feedback-sdk
pnpm add     @mahmulp/feedback-sdk
yarn add     @mahmulp/feedback-sdk
```

## Quick start

You always need an `apiUrl` and an `apiKey`. The key tells the API which project this prototype belongs to — generate one in your dashboard's project settings.

### Vanilla / React / Vue

```ts
import { initFeedback } from '@mahmulp/feedback-sdk'

initFeedback({
  apiUrl: 'https://feedback.example.com',
  apiKey: 'mp_…',
})
```

That's it. A floating launcher appears in the bottom-right corner.

### Svelte / SvelteKit

```svelte
<script lang="ts">
  import { feedback } from '@mahmulp/feedback-sdk/svelte'
</script>

<div use:feedback={{
  apiUrl: 'https://feedback.example.com',
  apiKey: 'mp_…',
}}>
  <slot />
</div>
```

### Local development without a backend

For demos, e2e tests, or styling work — use the in-memory mock transport:

```ts
import { initFeedback } from '@mahmulp/feedback-sdk'
import { createMockTransport } from '@mahmulp/feedback-sdk/mock'

initFeedback({ transport: createMockTransport() })
```

## What it does

When the user enters feedback mode (via the launcher or `setEnabled(true)`):

- **Hover** any element → outline highlight + tag/class HUD.
- **Click** → composer popover (name, email, comment, optional screenshot).
- **Alt-click** → walks one parent up so you can pin a coarser element.
- **Esc** → cancel.

Existing pins are rendered as draggable markers. Click a pin to open its thread, reply, or change status. Drop a `data-feedback-id="some-key"` attribute on important elements to make their selectors human-readable and refactor-proof.

## Public API

```ts
import {
  initFeedback,
  setFeedbackEnabled,
  destroyFeedback,
  resolveSelector,
  findElement,
  createHttpTransport,
  captureViewport,
} from '@mahmulp/feedback-sdk'
```

```ts
import { feedback, feedbackEnabled } from '@mahmulp/feedback-sdk/svelte'
```

```ts
import { createMockTransport } from '@mahmulp/feedback-sdk/mock'
```

The full set of options is documented in `InitFeedbackOptions` (TypeScript types ship with the package).

## Self-host the backend

The SDK pairs with a small self-hostable backend (Hono on Bun + PostgreSQL or in-memory store) that lives in the same monorepo: <https://github.com/MahmulP/feedback-prototype>. The dashboard there manages users, projects, and per-project API keys.

## License

MIT © Mahmul Pratama
