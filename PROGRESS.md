# Progress

Hidup-update progress untuk seluruh proyek. Centang berarti sudah selesai dan terverifikasi (typecheck + test atau build).

> Scope npm: semua package internal pakai **`@mahmulp/*`** (sebelumnya `@iwkapps/*`). Storage key dan attribute SDK pakai prefix `mahmulp` / `data-mahmulp-feedback-host`.

## Foundation

- [x] Steering files (`.kiro/steering/`)
- [x] Bun monorepo (`apps/*`, `packages/*`, `packages/feedback-sdk/examples/*`)
- [x] `tsconfig.base.json` (root tsconfig dihapus karena setiap package punya sendiri)
- [x] Move scaffold Next.js ke `apps/dashboard/`
- [x] Shared types (`@mahmulp/shared-types`) — Feedback, Project, ProjectApiKey, User
- [x] Rename scope npm → `@mahmulp/*`

## SDK (`@mahmulp/feedback-sdk`)

- [x] Core public API: `initFeedback`, `setFeedbackEnabled`, `destroyFeedback`
- [x] **API key required**: `apiUrl + apiKey` resolves the project server-side
- [x] Selector resolver (`data-feedback-id` → id → structural → tag.class)
- [x] Coordinate math (percent + pixel + viewport metadata, orphan fallback)
- [x] Shadow DOM overlay (highlight ring, HUD)
- [x] Hover + click + Alt-click (parent select) + Escape interactions
- [x] Pin rendering, status colors, orphaned styling
- [x] Composer popover (name/email/body)
- [x] Thread popover (comments, reply, status transitions)
- [x] Author identity persistence (localStorage, override hooks)
- [x] HTTP transport (sends `x-feedback-key`)
- [x] In-memory mock transport (`@mahmulp/feedback-sdk/mock`)
- [x] Svelte adapter (`@mahmulp/feedback-sdk/svelte`): `feedback` action + `feedbackEnabled` store
- [x] Screenshot capture via `html2canvas` (dynamic import, viewport-only)
- [x] Drag-to-move pins (pointer events, optimistic update + rollback)
- [x] Build pipeline: ESM + CJS + IIFE + `.d.ts` (tsup)
- [x] Tests: 47 unit (selector, coordinates, identity, popover, screenshot, mock, controller)

## SvelteKit example

- [x] Demo app under `packages/feedback-sdk/examples/sveltekit/`
- [x] Mock transport wired up
- [x] Toggle button + keyboard shortcut

## API (`@mahmulp/api`)

- [x] Hono app, route boundaries with zod validation
- [x] Users + projects + per-project API keys data model
- [x] Auth: cookie session for users (`POST /v1/auth/signup`, `login`, `logout`, `me`)
- [x] Project CRUD (`/v1/projects`, owner-scoped) + API key issue / list / revoke
- [x] SDK ingest (`POST /v1/feedback`) — projectId derived from key, body has none
- [x] SDK list (`GET /v1/feedback`) — scoped by key
- [x] PATCH coordinates (drag-to-move, project-key scoped)
- [x] Status transitions (`PATCH /v1/feedback/:id`, owner-only)
- [x] Comment thread reply (owner OR project key)
- [x] Local filesystem storage with path-traversal & MIME guards
- [x] Per-key rate limit on ingest endpoints
- [x] Structured JSON logging
- [x] Env validated centrally (`src/env.ts`)
- [x] Argon2id (Bun) password hashing with PBKDF2 fallback (Node test runner)
- [x] In-memory store (default for local dev)
- [x] **Drizzle / PostgreSQL store** (auto-switch when `DATABASE_URL` is set)
- [x] Drizzle schema + 2 migrations (`drizzle/0000_initial.sql`, `0001_users_projects.sql`)
- [x] Migration runner (`bun --filter @mahmulp/api migrate`) with `_drizzle_migrations` ledger
- [x] Tests: 25 (env + storage + 13 route tests covering signup, projects, ingest, scoping)

## Dashboard (`@mahmulp/dashboard`)

- [x] Next.js scaffold relocated to `apps/dashboard/`
- [x] `transpilePackages` configured for workspace packages
- [x] shadcn/ui primitives vendored (`button`, `card`, `input`, `textarea`, `badge`, `separator`)
- [x] Tailwind v4 theme dengan token dark green OKLCH
- [x] Centralized env module (`src/lib/env.ts`) — zod-validated server + lazy public env
- [x] `.env.example` lengkap dengan komentar
- [x] Server-side API client (`src/lib/api.ts`) dengan `import "server-only"` dan cookie forwarding
- [x] Edge middleware redirect: `/projects/*` → `/login` saat tidak ada cookie
- [x] Login + signup form (toggle), session bridge (set-cookie diteruskan ke browser)
- [x] Logout server action
- [x] Sidebar layout (`app/(dashboard)/layout.tsx`) + Sidebar component dengan project list, badges open count, link API keys + Settings, sign-out
- [ ] Project list page (`/projects`) — needs rewrite untuk scope per-owner + tombol "New project"
- [ ] New-project page (`/projects/new`) — form create project
- [ ] Project settings page (`/projects/[slug]/settings`) — edit name/description/origins, delete project
- [ ] API keys page (`/projects/[slug]/keys`) — list, issue (modal one-shot), revoke
- [ ] Feedback list page — needs migration from `[projectId]` to `[slug]`
- [ ] Feedback detail page — needs migration from `[projectId]` to `[slug]` and update API client calls

## End-to-end

- [x] Smoke test script `scripts/e2e-smoke.ts` (**12 checks**, semua passing)
- [x] Smoke verified terhadap Postgres (`DATABASE_URL`) — user, project, dan feedback tersimpan
- [x] Deployment guide (`docs/deployment.md`) — single-host, Caddy, systemd, backups
- [ ] CI workflow GitHub Actions (`.github/workflows/ci.yml`) — masih perlu di-update untuk env baru

## Tools / scripts

- [x] `scripts/e2e-smoke.ts` — E2E smoke runner (`bun run smoke`)
- [x] `scripts/rename-scope.ps1` — workspace-wide scope rename helper
- [x] `scripts/strip-bom.ps1` — UTF-8 BOM remover
- [x] `apps/api/scripts/migrate.ts` — Drizzle SQL migration runner
