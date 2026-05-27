# @mahmulp/feedback-sdk

Framework-agnostic visual feedback SDK for prototype review. Pin comments to UI elements, capture stable DOM selectors plus coordinates, and sync them to your self-hosted backend.

**Primary target:** Svelte / SvelteKit. Works fine in React, Vue, and plain HTML via the same core API.

## Install

```bash
bun add @mahmulp/feedback-sdk
```

## Svelte

```svelte
<script lang="ts">
  import { feedback, feedbackEnabled } from '@mahmulp/feedback-sdk/svelte'
  const enabled = feedbackEnabled()
</script>

<div use:feedback={{ apiUrl: import.meta.env.VITE_FEEDBACK_API, projectId: 'prototype-a' }}>
  <slot />
</div>

<button on:click={() => enabled.toggle()}>
  {$enabled ? 'Stop' : 'Start'} feedback
</button>
```

## React

```tsx
import { useEffect } from 'react'
import { initFeedback } from '@mahmulp/feedback-sdk'

useEffect(() => {
  const ctrl = initFeedback({
    apiUrl: import.meta.env.VITE_FEEDBACK_API,
    projectId: 'prototype-a',
  })
  return () => ctrl.destroy()
}, [])
```

## Vanilla / CDN

```html
<script src="/feedback-sdk.global.js"></script>
<script>
  const ctrl = FeedbackSDK.initFeedback({
    apiUrl: '/api',
    projectId: 'prototype-a',
  })
  document.querySelector('#toggle').addEventListener('click', () => {
    ctrl.setEnabled(!ctrl.isEnabled())
  })
</script>
```

## Local development without a backend

The package ships a tiny in-memory transport for use before the API exists:

```ts
import { initFeedback } from '@mahmulp/feedback-sdk'
import { createMockTransport } from '@mahmulp/feedback-sdk/mock'

const transport = createMockTransport()
const ctrl = initFeedback({ projectId: 'demo', transport })
```

## Interaction model

When feedback mode is enabled:

- **Hover** outlines the element under the cursor.
- **Click** picks it as the pin target and creates a pin.
- **Alt-click** walks one level up the DOM tree (modifier configurable via `selectParentModifier`).
- **Escape** cancels selection.

Pins survive layout changes by storing both a stable DOM selector (preferring `data-feedback-id`) and percentage-based coordinates. When the selector no longer resolves, the pin is rendered as **orphaned** at its original page-pixel coordinate.

## Public API

```ts
import {
  initFeedback,
  setFeedbackEnabled,
  destroyFeedback,
  resolveSelector,
  findElement,
  createHttpTransport,
} from '@mahmulp/feedback-sdk'
```

```ts
import { feedback, feedbackEnabled } from '@mahmulp/feedback-sdk/svelte'
```

```ts
import { createMockTransport } from '@mahmulp/feedback-sdk/mock'
```

See the [conventions](../../.kiro/steering/sdk-conventions.md) for the rules the SDK plays by.
