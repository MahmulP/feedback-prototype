# Feedback Prototype

Self-hosted visual feedback platform for prototype review. Reviewers pin comments directly onto UI elements; you get back a stable DOM selector, percentage + pixel coordinates, viewport metadata, and an optional screenshot — all in your own database.

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Prototype site  │     │   Hono API       │     │  Next.js dash    │
│  + SDK overlay   │ ──► │  Postgres + FS   │ ◄── │  (you, the team) │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

Three pieces ship in this monorepo:

| Path | What it is |
| --- | --- |
| `packages/feedback-sdk` | Browser SDK — published to npm as **[`@mahmulp/feedback-sdk`](https://www.npmjs.com/package/@mahmulp/feedback-sdk)** |
| `apps/api` | Hono on Bun · PostgreSQL via Drizzle (in-memory fallback) · local-disk screenshots |
| `apps/dashboard` | Next.js 16 + React 19 + shadcn/ui · login / projects / API keys / feedback inbox |

---

## Table of contents

1. [Use the SDK in your prototype](#use-the-sdk-in-your-prototype)
2. [Run the full stack locally (monorepo dev)](#run-the-full-stack-locally-monorepo-dev)
3. [Deploy](#deploy)
4. [Project layout](#project-layout)
5. [Troubleshooting](#troubleshooting)

---

## Use the SDK in your prototype

You don't need to clone this repo to use the SDK. Install it from npm and point it at any running API instance.

### Install

```bash
# bun
bun add @mahmulp/feedback-sdk

# npm
npm install @mahmulp/feedback-sdk

# pnpm
pnpm add @mahmulp/feedback-sdk

# yarn
yarn add @mahmulp/feedback-sdk
```

Screenshot capture works out of the box — `html2canvas-pro` ships as a direct dependency and is loaded on demand the first time a pin is created. We use the `-pro` fork because it understands modern CSS color spaces (`oklch`, `lab`, `color-mix`) used by Tailwind v4 and most modern design systems; the original `html2canvas` errors out on those.

### Get an API key

1. Run the API + dashboard (see [next section](#run-the-full-stack-locally-monorepo-dev)) — or use a deployed instance.
2. Sign up in the dashboard, create a project.
3. Open **API keys**, click **Generate new key**, and copy the plaintext key (shown once, format `mp_…`).

### Plain JavaScript / TypeScript / React / Vue

```ts
import { initFeedback } from '@mahmulp/feedback-sdk'

initFeedback({
  apiUrl: 'http://localhost:8787', // or your deployed API URL
  apiKey: 'mp_…',                   // from the dashboard
})
```

That's it. A floating launcher appears in the bottom-right corner. Toggle it, click any element, leave a comment.

In React, do the same inside `useEffect` and clean up:

```tsx
import { useEffect } from 'react'
import { initFeedback } from '@mahmulp/feedback-sdk'

export function FeedbackProvider() {
  useEffect(() => {
    const ctrl = initFeedback({
      apiUrl: import.meta.env.VITE_FEEDBACK_API_URL,
      apiKey: import.meta.env.VITE_FEEDBACK_API_KEY,
    })
    return () => ctrl.destroy()
  }, [])
  return null
}
```

### Svelte / SvelteKit (preferred ergonomics)

```svelte
<script lang="ts">
  import { feedback } from '@mahmulp/feedback-sdk/svelte'
</script>

<div use:feedback={{
  apiUrl: import.meta.env.VITE_FEEDBACK_API_URL,
  apiKey: import.meta.env.VITE_FEEDBACK_API_KEY,
}}>
  <slot />
</div>
```

In SvelteKit, drop this in `src/routes/+layout.svelte` and the entire app is wired up.

### Plain HTML (CDN)

```html
<script src="https://unpkg.com/@mahmulp/feedback-sdk/dist/index.global.js"></script>
<script>
  FeedbackSDK.initFeedback({
    apiUrl: 'http://localhost:8787',
    apiKey: 'mp_…',
  })
</script>
```

### Demo mode (no backend)

For styling work or just trying the UX:

```ts
import { initFeedback } from '@mahmulp/feedback-sdk'
import { createMockTransport } from '@mahmulp/feedback-sdk/mock'

initFeedback({ transport: createMockTransport() })
```

### What the user sees

A pill in the bottom-right with three buttons:
- **Feedback** — toggle pin-creation mode (turns red when active)
- 👁 — show / hide existing pins
- × — hide the launcher entirely; a small reveal button appears in its place. `Ctrl/⌘+Shift+F` brings it back.

---

## Run the full stack locally (monorepo dev)

This is the path if you want to run the API + dashboard yourself, or contribute back to this repo.

### Prerequisites

- **Bun** ≥ 1.1 — <https://bun.sh>
- **Node 20+** on `PATH` (Next.js workers use it)
- **PostgreSQL 14+** — optional. Without it the API uses an in-memory store (data lost on restart). For real persistence, install Postgres (Docker is fine).

### 1. Clone & install

```bash
git clone https://github.com/MahmulP/feedback-prototype.git
cd feedback-prototype
bun install
```

### 2. Build the SDK locally

The dashboard and the example SvelteKit app import from `@mahmulp/feedback-sdk` via a workspace symlink. Build it once so the artifacts exist:

```bash
bun --filter @mahmulp/feedback-sdk build
```

### 3. Set up the API

```bash
cd apps/api
cp .env.example .env
```

Open `apps/api/.env` and fill in:

```ini
PORT=8787
STORAGE_DIR=./data/screenshots
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Optional: leave blank to use in-memory store (data lost on API restart)
DATABASE_URL=postgres://postgres:yourpassword@localhost:5432/feedback

# Required for cookie sessions. Generate one of these:
#   openssl rand -hex 32
SESSION_SECRET=replace-with-a-32-byte-random-string
```

If you set `DATABASE_URL`, run the migrations:

```bash
# from apps/api/
bun run migrate
```

This applies every `*.sql` in `apps/api/drizzle/` and tracks them in a `_drizzle_migrations` table.

> **Postgres setup tip (Docker):**
> ```bash
> docker run -d --name fbpg \
>   -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=yourpassword -e POSTGRES_DB=feedback \
>   -p 5432:5432 postgres:16
> ```

Start the API:

```bash
bun run dev
```

Health check: <http://localhost:8787/health> should return `{"ok":true}`.

### 4. Set up the dashboard

```bash
cd ../dashboard
cp .env.example .env
```

`apps/dashboard/.env`:

```ini
FEEDBACK_API_URL=http://localhost:8787
NEXT_PUBLIC_FEEDBACK_API_URL=http://localhost:8787
NEXT_PUBLIC_APP_NAME=Feedback
LOG_LEVEL=info
```

Run it:

```bash
bun run dev --port 3000
```

Open <http://localhost:3000>:
1. Sign up with email + password.
2. Click **+ New project**, give it a slug (e.g. `prototype-a`).
3. Open the **API keys** tab → **Generate new key** → copy the `mp_…` key.

### 5. Use the SDK against your local API

In any prototype project (your own SvelteKit / Next / vanilla site):

```ts
import { initFeedback } from '@mahmulp/feedback-sdk'

initFeedback({
  apiUrl: 'http://localhost:8787',
  apiKey: 'mp_…',
})
```

Or, to try the SvelteKit example included in this repo:

```bash
cd packages/feedback-sdk/examples/sveltekit
cp .env.example .env
# Edit .env: set VITE_FEEDBACK_API_KEY=mp_…
bun run dev   # → http://localhost:5173
```

Make a pin in the example → it shows up in the dashboard's Feedback tab.

### 6. (Optional) Smoke test

Verifies the full flow signup → project → key → ingest → read → screenshot:

```bash
# from repo root
bun run smoke
```

### Useful root-level commands

```bash
bun run dev:api          # start the API
bun run dev:dashboard    # start the dashboard
bun run build:sdk        # rebuild the SDK
bun run test:sdk         # run SDK unit tests
bun run test:api         # run API unit tests
bun run typecheck        # typecheck every workspace
bun run smoke            # E2E smoke
```

---

## Deploy

A single-host setup with systemd + Caddy is documented in [`docs/deployment.md`](./docs/deployment.md). It covers env files, schema apply, process supervision, reverse proxy with TLS, backups, and upgrade procedure.

The headline:

- **One server, three processes**: API (port 8787), dashboard (port 3000), Postgres.
- **Two pieces of state**: the Postgres dump and the `STORAGE_DIR` (screenshots). Back them up together.
- **No third-party dependencies required** — no S3, no R2, no MinIO. Files live on the API host's local disk.

---

## Project layout

```
feedback-prototype/
├── apps/
│   ├── api/                    Hono + Drizzle backend
│   │   ├── src/
│   │   ├── scripts/migrate.ts  apply drizzle/*.sql + ledger
│   │   └── drizzle/            ordered SQL migrations
│   └── dashboard/              Next.js + shadcn/ui dashboard
├── packages/
│   ├── feedback-sdk/           published SDK
│   │   └── examples/sveltekit  reference integration
│   └── shared-types/           internal wire types (workspace-only)
├── scripts/
│   └── e2e-smoke.ts            end-to-end smoke test
└── docs/
    └── deployment.md
```

---

## Troubleshooting

### `bun add @mahmulp/feedback-sdk` returns 404

Most common reasons:

1. **Custom registry override.** Check whether your project or environment points at a private registry. Run:
   ```bash
   npm config get registry
   bun pm bun config get registry   # newer Bun
   ```
   The expected value is `https://registry.npmjs.org/`. If it's anything else, add a public-registry override:
   ```bash
   echo "@mahmulp:registry=https://registry.npmjs.org/" >> .npmrc
   ```

2. **Stale Bun cache.** Bun caches negative lookups briefly:
   ```bash
   bun pm cache rm
   bun add @mahmulp/feedback-sdk
   ```

3. **You're behind a proxy** that strips scoped packages — try `npm install` instead and see if the error message is clearer.

Confirm the package is actually on npmjs.org:
```bash
npm view @mahmulp/feedback-sdk
```
…or open <https://www.npmjs.com/package/@mahmulp/feedback-sdk>.

### API logs `using in-memory store (set DATABASE_URL to persist)`

That's intentional info, not an error. With `DATABASE_URL` unset, the API runs without Postgres. Set it (and run `bun run migrate`) to switch to persistent storage.

### Dashboard says "API offline"

The dashboard couldn't reach `FEEDBACK_API_URL`. Make sure the API process is running and reachable on that URL from the machine running the dashboard.

### Screenshots don't show in the dashboard

- The SDK option `captureScreenshots` defaults to `true` in production HTTP mode. `html2canvas-pro` ships as a direct dependency, so a missing-import warning here usually means a bundler is mis-handling dynamic imports — open an issue with the bundler version.
- Check the `STORAGE_DIR` on the API host — files are saved as `screenshots/{feedbackId}.{png|jpg|webp}`.

---

## License

MIT © [Mahmul Pratama](https://github.com/MahmulP)
