# Feedback Prototype

Open-source, self-hosted visual feedback platform for web prototypes. Pin comments directly to UI elements, track threads, manage status â€” without the manual screenshot + chat dance.

This is a **Bun workspace monorepo**.

## Layout

```
apps/
  dashboard/         # Next.js + React dashboard
packages/
  feedback-sdk/      # @mahmulp/feedback-sdk â€” framework-agnostic SDK (Svelte primary)
  shared-types/      # @mahmulp/shared-types â€” wire types shared across apps & SDK
```

The backend API (`apps/api`) lands in a follow-up iteration. The SDK ships with a tiny in-memory transport for local development, swappable for HTTP later.

## Getting started

```bash
# install everything
bun install

# build the SDK
bun run build:sdk

# run the dashboard (Next.js scaffold for now)
bun run dev:dashboard
```

## Steering & specs

Project-wide conventions live under [`.kiro/steering/`](./.kiro/steering/):

- `product.md` â€” vision and scope
- `tech.md` â€” stack and tooling
- `structure.md` â€” monorepo conventions
- `feedback-data-model.md` â€” shared wire format
- `sdk-conventions.md`, `dashboard-conventions.md`, `api-conventions.md` â€” per-package rules

Read them before changing fundamentals.
