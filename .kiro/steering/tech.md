---
inclusion: always
---

# Tech Stack & Tooling

## Current state of the repo
The repo today is a **Next.js 16 + React 19 + Tailwind v4** scaffold from `create-next-app`. This scaffold will be replaced/restructured into a monorepo as the product is built. Treat the existing `app/` directory as throwaway scaffolding unless explicitly told otherwise.

> Heads up: per `AGENTS.md`, the installed Next.js has breaking changes vs. older training data. If you ever need to touch Next.js code, read the relevant guide in `node_modules/next/dist/docs/` first.

## Target tech stack

### Workspace & package manager
- **Bun workspaces** â€” single repo, multiple packages.
- **bun** as the runtime and package manager. Use `bun install`, `bun run`, `bun x`. Prefer `bun` over `npm`/`pnpm`/`yarn` in scripts and docs.
- A `bun.lock` is committed; respect it.

### Language
- **TypeScript everywhere.** No JS files in production code. `strict: true` is mandatory. Avoid `any` â€” prefer `unknown` plus narrowing.

### SDK (`packages/feedback-sdk`)
- **TypeScript** library, **framework-agnostic core** with **Svelte as the primary target**. The SDK works in React, Vue, plain HTML, and SvelteKit â€” Svelte is just the reference integration that gets first-class docs, examples, and an optional adapter sub-entry.
- The SDK *core* is plain TypeScript that talks to the DOM directly â€” **zero runtime dependency on any UI framework**. This keeps the bundle small and the integration story portable.
- A thin official **Svelte adapter** ships as a sub-entry (`@mahmulp/feedback-sdk/svelte`) exposing a `feedback` action and an `enabled` store. Built so SvelteKit users get idiomatic ergonomics; tree-shaken away for everyone else.
- React / Vue / vanilla integrations are supported via the core API plus copy-paste docs snippets. We do not ship adapter packages for them in v1, but the core is tested against each so it stays honest.
- Bundled with **tsup** producing both ESM and CJS, plus type declarations.
- Optional UMD/IIFE build for CDN `<script>` usage.
- Runtime helpers (when needed):
  - **Floating UI** â€” anchored marker positioning.
  - **Interact.js** â€” drag interactions for pins.
  - **html2canvas** â€” screenshot capture.
- Keep peer dependencies empty. Bundle small libs; expose larger ones as optional dynamic imports.

### Backend API (`apps/api`)
- **Hono** or **Elysia** (pick one and stick with it; default to **Hono** for portability across Bun/Node/edge runtimes).
- **PostgreSQL** as the primary datastore. Use a typed query layer (Drizzle ORM is the default unless overridden).
- **Object storage** for screenshots: **local filesystem on the API host only.** No S3, no R2, no MinIO. Files live under a configurable directory (e.g. `STORAGE_DIR=./data/screenshots`) and are served back through the API process. Storage logic lives behind a thin interface so a future driver can be added without touching routes, but the v1 product ships with a single `LocalDiskDriver`.
- Auth: simple project API keys for SDK ingest; session-based auth (cookie) for dashboard users. Keep it minimal â€” no SSO/OAuth in v1.

### Dashboard (`apps/dashboard`)
- **Next.js (App Router) with React 19** and TypeScript. The repo is already on Next.js 16; we keep that runtime for the dashboard.
- UI components: **shadcn/ui** (the React/Next.js original, not the Svelte port). Components are vendored into `src/components/ui/` via the shadcn CLI â€” they are part of our source, not an npm dependency.
- Styling: **TailwindCSS v4** with a custom theme. Primary color is a deep, rich dark green (see `dashboard-conventions.md` for exact tokens).
- Icons: **lucide-react**.
- Talks to the API over HTTP/JSON. No direct DB access from the dashboard.
- Per `AGENTS.md`, the installed Next.js has breaking changes vs. older training data â€” read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js-specific code.

### Shared types (`packages/shared-types`)
- TypeScript-only package containing the wire types shared between SDK, API, and dashboard (Feedback, Project, Comment, Selector payload, etc.). No runtime code.

## Tooling conventions
- **Linting:** ESLint with the project's flat config. Run `bun run lint` before declaring a task complete.
- **Formatting:** keep formatting consistent with the existing config; do not introduce a new formatter without discussion.
- **Testing:** prefer `vitest` for unit tests in SDK and shared-types, and a lightweight integration runner for the API. Use `--run` flag (single shot) when invoking from automation; never start watch mode in agent scripts.
- **No long-running commands in tool calls.** Dev servers, watchers, and the like must be started by the user manually, not by the agent.

## Common commands (target)
Once the monorepo is in place, the canonical commands will be:

```bash
# install everything
bun install

# run the dashboard dev server (manual, by the user)
bun --filter ./apps/dashboard dev

# run the API dev server (manual, by the user)
bun --filter ./apps/api dev

# build the SDK
bun --filter ./packages/feedback-sdk build

# typecheck a package
bun --filter ./packages/feedback-sdk typecheck

# lint everything
bun run lint
```

Until the monorepo migration lands, the existing `next dev` / `next build` / `eslint` scripts in the root `package.json` remain the source of truth.
