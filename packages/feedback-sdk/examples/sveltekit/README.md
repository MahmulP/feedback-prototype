# Feedback SDK Â· SvelteKit example

A minimal SvelteKit prototype that uses `@mahmulp/feedback-sdk/svelte` and the in-memory mock transport. Doubles as the integration smoke test for the SDK.

## Run

```bash
# from the repo root
bun install
bun --filter @mahmulp/feedback-sdk build

# from this folder
bun run dev
```

Open http://localhost:5173 and click **Start feedback**, then click any element on the page.

## What it shows

- The Svelte action `use:feedback={{ projectId, transport }}`.
- The `feedbackEnabled()` store driving a toggle button.
- `data-feedback-id` attributes on cards so the captured selectors are stable.
- The mock transport, so pins persist across the session without a backend.

Replace the mock transport with `{ apiUrl: import.meta.env.VITE_FEEDBACK_API, projectId: 'demo' }` once the API exists.
