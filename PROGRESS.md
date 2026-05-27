# Progress

Hidup-update progress untuk seluruh proyek. Centang berarti sudah selesai dan terverifikasi (typecheck + test atau build).

> Scope npm: semua package internal sudah pakai **`@mahmulp/*`** (sebelumnya `@iwkapps/*`). Storage key dan attribute SDK pakai prefix `mahmulp` / `data-mahmulp-feedback-host`.

## Foundation

- [x] Steering files (`.kiro/steering/`)
- [x] Bun monorepo (`apps/*`, `packages/*`, `packages/feedback-sdk/examples/*`)
- [x] `tsconfig.base.json` dan project references
- [x] Move scaffold Next.js ke `apps/dashboard/`
- [x] Shared types (`@mahmulp/shared-types`)
- [x] Rename scope npm → `@mahmulp/*` (40 file di-rewrite, BOM stripped, install + typecheck + test + build clean)

## SDK (`@mahmulp/feedback-sdk`)

- [x] Core public API: `initFeedback`, `setFeedbackEnabled`, `destroyFeedback`
- [x] Selector resolver (`data-feedback-id` → id → structural → tag.class)
- [x] Coordinate math (percent + pixel + viewport metadata, orphan fallback)
- [x] Shadow DOM overlay (highlight ring, HUD)
- [x] Hover + click + Alt-click (parent select) + Escape interactions
- [x] Pin rendering, status colors, orphaned styling
- [x] Composer popover (name/email/body)
- [x] Thread popover (comments, reply, status transitions)
- [x] Author identity persistence (localStorage, override hooks)
- [x] HTTP transport
- [x] In-memory mock transport (`@mahmulp/feedback-sdk/mock`)
- [x] Svelte adapter (`@mahmulp/feedback-sdk/svelte`): `feedback` action + `feedbackEnabled` store
- [x] Screenshot capture via `html2canvas` (dynamic import, viewport-only)
- [x] Drag-to-move pins (pointer events, optimistic update + rollback, click-suppression after drag)
- [x] Build pipeline: ESM + CJS + IIFE + `.d.ts` (tsup)
- [x] Tests: 46 unit (selector, coordinates, identity, popover, screenshot, mock, controller)

## SvelteKit example

- [x] Demo app under `packages/feedback-sdk/examples/sveltekit/`
- [x] Mock transport wired up
- [x] Toggle button + keyboard shortcut
- [x] Build verified (Vite + SvelteKit)

## API (`@mahmulp/api`)

- [x] Hono app, route boundaries with zod validation
- [x] In-memory `FeedbackStore` with project summary aggregation
- [x] Drizzle/PostgreSQL store (`src/db/`) + initial migration (`drizzle/0000_initial.sql`)
- [x] Auto-switch: in-memory by default, Postgres when `DATABASE_URL` is set
- [x] Local filesystem `LocalDiskDriver` with path-traversal & MIME guards
- [x] Routes: list / get one / create / reply / patch status / move pin / upload screenshot / read screenshot / list projects / health
- [x] Per-project API keys + `requireSdkKey` / `requireAdminKey` middleware
- [x] Token-bucket rate limiting on ingest endpoints (per-key, configurable)
- [x] Structured JSON logging middleware with request id propagation
- [x] Env validated centrally (`src/env.ts`)
- [x] Tests: 34 (env + storage + routes + auth + rate limit)

## Dashboard (`@mahmulp/dashboard`)

- [x] Next.js scaffold relocated to `apps/dashboard/`
- [x] `transpilePackages` configured for workspace packages
- [x] shadcn/ui primitives vendored (`button`, `card`, `input`, `textarea`, `badge`, `separator`)
- [x] Tailwind v4 theme dengan token dark green OKLCH
- [x] Centralized env module (`src/lib/env.ts`) — zod-validated server + lazy public env
- [x] `.env.example` lengkap dengan komentar setiap variabel (auth + API)
- [x] Server-side API client (`src/lib/api.ts`) dengan `import "server-only"`
- [x] Layout + header + footer + session bar
- [x] Project list page (`/projects`) dengan empty-state install snippet
- [x] Feedback list page (`/projects/[projectId]`) dengan status + page filters
- [x] Feedback detail page (`/projects/[projectId]/feedback/[feedbackId]`) dengan screenshot + pin overlay + thread + status
- [x] Server Actions: change status (`updateStatusAction`), reply (`replyAction`)
- [x] Auth UX: HMAC cookie session, login form, logout, edge middleware redirect
- [x] StatusBadge component dengan icon + aria-label (tidak color-only)
- [x] API offline banner saat backend mati
- [x] sonner toaster terpasang
- [x] Build verified (Next.js 16 + Turbopack)
- [ ] Multi-user accounts (DB-backed) — v1 ships single-admin via env

## End-to-end

- [x] Smoke test script `scripts/e2e-smoke.ts` (11 checks, semua passing)
- [x] Smoke verified: SDK ingest ↔ API ↔ dashboard read flow
- [x] Smoke verified: Dashboard auth gate (middleware redirect to /login)
- [x] CI workflow GitHub Actions (`.github/workflows/ci.yml`): typecheck + test + build + smoke
- [x] Deployment guide (`docs/deployment.md`) — single-host, systemd, Caddy, backups

## Tools / scripts

- [x] `scripts/e2e-smoke.ts` — E2E smoke runner (`bun run smoke`)
- [x] `scripts/rename-scope.ps1` — workspace-wide scope rename helper
- [x] `scripts/strip-bom.ps1` — UTF-8 BOM remover (post-rename utility)
