---
inclusion: fileMatch
fileMatchPattern: 'apps/dashboard/**'
---

# Dashboard Conventions

Apply these rules whenever working inside `apps/dashboard/`.

## Framework
- **Next.js (App Router) with React 19** and TypeScript. Server Components by default; reach for `"use client"` only when you need browser-only APIs, state, or event handlers.
- TailwindCSS v4 for styling, theme defined as CSS variables (see "Theme & primary color" below).
- Per `AGENTS.md` at the repo root: this Next.js has breaking changes vs older training data. **Read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js-specific code** (route handlers, caching, fetch semantics, metadata, middleware). Do not rely on memory.

## UI components — shadcn/ui
- Use **shadcn/ui** (the React/Next.js original).
- Components are added with the CLI (`bunx shadcn@latest add button`, etc.) and **vendored** into `src/components/ui/`. Treat them as project source: edit, restyle, and tweak freely.
- Do not pull in another component library on top of shadcn/ui. If a primitive is missing, build it on top of the **Radix UI** primitives shadcn already uses, rather than introducing a new dep.
- Re-export wrapped variants from `src/components/` (one level up) when a project-specific style is needed; never modify call sites by sprinkling Tailwind classes onto every shadcn import.
- Icons: **lucide-react**.
- Forms: **react-hook-form + zod** with the shadcn `<Form>` wrapper. Keep zod schemas in `src/lib/validators/` so they're reusable on server actions.
- Toasts/notifications: shadcn's **sonner** integration.

## Theme & primary color
The dashboard uses a **dark green** primary palette. The vibe: forest / pine, not lime, not mint. Both light and dark modes share the hue but adjust lightness for contrast.

Define the theme in `src/app/globals.css` using the shadcn token names (the Tailwind v4 `@theme` block) so all generated components pick it up automatically:

```css
@theme {
  /* Brand: deep dark green */
  --color-primary:               oklch(0.38 0.09 155);   /* ~#1F5132 */
  --color-primary-foreground:    oklch(0.98 0.01 150);
  --color-ring:                  oklch(0.38 0.09 155);

  /* Optional accent on top of the green family */
  --color-accent:                oklch(0.92 0.04 150);
  --color-accent-foreground:     oklch(0.20 0.06 155);
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-primary:             oklch(0.55 0.11 155);   /* lifted for dark bg */
    --color-primary-foreground:  oklch(0.10 0.02 155);
    --color-ring:                oklch(0.55 0.11 155);
    --color-accent:              oklch(0.25 0.05 155);
    --color-accent-foreground:   oklch(0.95 0.02 150);
  }
}
```

Rules:
- All "primary" actions (CTA buttons, active nav, focus rings, status pills for `resolved`) use `--color-primary`.
- Never hardcode green hex values inside components; always go through the token. If a one-off green is needed, add a new token, don't inline it.
- Maintain WCAG AA contrast: primary on background ≥ 4.5:1 for text, ≥ 3:1 for large text and icons. Re-check whenever the OKLCH lightness is tweaked.
- Status colors stay distinct from the brand green: `open` uses a neutral/amber tone, `resolved` uses the green primary, `archived` uses a muted gray. Never use two greens for two different statuses.

## Configuration via `.env`

Everything that can vary between deployments lives in environment variables. **No secrets, hostnames, or API keys are hardcoded in the dashboard source.**

### Files
- `.env` — local development values (gitignored).
- `.env.example` — committed template listing every variable the dashboard reads, with safe placeholder values. Updating one without the other is a review-blocker.
- `.env.production` is **not** committed; production values come from the deployment platform.

### Variable naming rules
- Server-only variables: plain names, e.g. `FEEDBACK_API_URL`. Read with `process.env.X` in Server Components, route handlers, and server actions only.
- Browser-exposed variables: must be prefixed `NEXT_PUBLIC_`. Anything not prefixed is server-only and must never appear in client components.
- All variables are validated at startup via a single zod schema in `src/lib/env.ts`. The app refuses to boot if required vars are missing or malformed.

### Required variables (v1)
| Name                          | Scope     | Purpose                                                                 |
|-------------------------------|-----------|-------------------------------------------------------------------------|
| `FEEDBACK_API_URL`            | server    | Internal URL used by Server Components / route handlers to call the API |
| `NEXT_PUBLIC_FEEDBACK_API_URL`| browser   | Public URL for any client-side calls or for showing in install snippets |
| `DASHBOARD_API_KEY`           | server    | Service-to-service key the dashboard sends to the API for admin routes  |
| `SESSION_SECRET`              | server    | 32+ byte random secret for signing the dashboard session cookie         |
| `NODE_ENV`                    | server    | `development` / `production` / `test`                                   |

### Optional / future
| Name                  | Scope    | Purpose                                                          |
|-----------------------|----------|------------------------------------------------------------------|
| `LOG_LEVEL`           | server   | `info` (default), `debug`, `warn`, `error`                       |
| `NEXT_PUBLIC_BRAND`   | browser  | Override the dashboard product name for white-label deployments  |

### Usage rules
- Read env via the validated `env` object exported from `src/lib/env.ts`. **Never** read `process.env.X` directly in component code.
- Never log the value of `DASHBOARD_API_KEY` or `SESSION_SECRET`. Reference them by name only.
- The signed session cookie uses `SESSION_SECRET`; rotating the secret invalidates all sessions, which is the intended behavior.
- `.env.example` doubles as the deployment checklist; the README links to it.

## Data flow
- The dashboard never talks to the database directly. Every read and write goes through the API over HTTP.
- Server Components and route handlers (`src/app/.../route.ts`) handle authenticated reads and forward the cookie session to the API. They use `FEEDBACK_API_URL` plus `DASHBOARD_API_KEY` for any admin-level call.
- Server Actions handle mutations (status changes, comment replies). Avoid calling the API from client components when a Server Action will do.
- Use `fetch` with explicit caching directives (`cache: 'no-store'` for personalized data, revalidation tags for shared lists). Read the Next.js fetch caching guide before deciding — defaults have changed.

## State & caching
- Keep client-side state minimal. List views can rely on `revalidateTag` after mutations rather than wiring a full client cache.
- Reach for `useState` and `useReducer` for genuinely local UI state. Reach for a store (Zustand) only after two unrelated client components need to share state — not before.

## Minimum feature set (v1)
The dashboard must support at least:
1. **Project list** — projects the logged-in user can access, with a count of open feedback.
2. **Feedback list** — per project, with filters by page URL and status.
3. **Feedback detail** — screenshot preview, the pinned element selector + page URL, and the full comment thread.
4. **Status management** — mark resolved, reopen, archive.

Anything beyond this set goes into a separate spec, not into v1 scope creep.

## Screenshots
- Render screenshots through the API endpoint that streams them from local disk (`GET /v1/feedback/{id}/screenshot`). Never embed raw bytes in JSON responses.
- Always include a fallback when the screenshot is missing (orphaned pin / capture failed).
- Show the pin overlay on top of the screenshot in the detail view: project the stored `xPercent / yPercent` onto the rendered image, not the raw pixel coordinates from the original viewport.
- Use `next/image` with `unoptimized` (or a configured remote pattern in `next.config.ts`) for screenshots, since they come from the API origin.

## Accessibility
- Every interactive control needs an accessible name and visible focus state. The shadcn/ui primitives handle this correctly out of the box — don't strip the focus ring.
- Modals and popovers must trap focus and restore it on close (Radix defaults are fine; verify on custom wrappers).
- Color-only indicators (status badges) must also carry text or an icon with `aria-label`. Don't rely on green vs. amber alone.

## Auth UX
- Login is a simple email/password form (no SSO in v1). On success, the API sets a cookie session and the dashboard redirects to `/projects`.
- Logout clears the session via a Server Action (POST), never via a GET link.
- The session cookie is signed with `SESSION_SECRET`; verify on every Server Component / route handler that touches authenticated data.
