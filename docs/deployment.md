# Deployment guide

This is a self-hosted, single-host setup. The dashboard, API, and screenshot files all live on the same machine. No S3, no R2, no MinIO.

## Topology

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                          One host                             â”‚
â”‚                                                               â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  HTTPS  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  HTTP   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚  â”‚  Browser  â”‚ â”€â”€â”€â”€â”€â”€â–¶ â”‚   Dashboard â”‚ â”€â”€â”€â”€â”€â”€â–¶ â”‚     API    â”‚ â”‚
â”‚  â”‚ (reviewer)â”‚         â”‚ (Next.js)   â”‚         â”‚  (Hono)    â”‚ â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚                                                      â”‚        â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  HTTPS                                â–¼        â”‚
â”‚  â”‚  Browser  â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶  PostgreSQL    â”‚
â”‚  â”‚(prototype)â”‚           (CORS allow-list)     /var/lib/.../  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                                â”‚
â”‚                                                  ./data/      â”‚
â”‚                                                  screenshots/ â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

The SDK in a prototype talks **directly** to the API over HTTPS. The dashboard talks to the API server-side using `FEEDBACK_API_URL` (which can be `http://localhost:8787` if both run on the same host).

## Prerequisites

- Bun â‰¥ 1.1
- Node 20+ available on `PATH` (used by Next.js workers)
- PostgreSQL 14+ (skip if you accept the in-memory store; data is lost on restart)
- A reverse proxy in front (nginx / Caddy) terminating TLS

## One-time setup

```bash
git clone <your fork>
cd feedback-prototype
bun install
bun run build:sdk
bun --filter @mahmulp/dashboard build
```

### API env

Create `apps/api/.env` from `.env.example` and fill in:

```bash
PORT=8787
STORAGE_DIR=/var/lib/feedback/screenshots
ALLOWED_ORIGINS=https://prototype.example.com,https://feedback.example.com
DATABASE_URL=postgres://feedback:secret@localhost:5432/feedback
```

Apply the schema once:

```bash
psql "$DATABASE_URL" -f apps/api/drizzle/0000_initial.sql
```

Make sure the storage directory exists and is writable only by the API user:

```bash
sudo mkdir -p /var/lib/feedback/screenshots
sudo chown -R feedback:feedback /var/lib/feedback
sudo chmod -R 700 /var/lib/feedback
```

### Dashboard env

Create `apps/dashboard/.env.production` from `.env.example`:

```bash
NODE_ENV=production
FEEDBACK_API_URL=http://127.0.0.1:8787
NEXT_PUBLIC_FEEDBACK_API_URL=https://feedback.example.com/api
NEXT_PUBLIC_APP_NAME=Feedback

SESSION_SECRET=<openssl rand -hex 32>
DASHBOARD_API_KEY=<openssl rand -hex 32>

ADMIN_EMAIL=admin@example.com
# Use the hash form in production. Rotate by updating it.
ADMIN_PASSWORD_HASH=<echo -n "yourpassword" | sha256sum>
```

`SESSION_SECRET` rotation invalidates every active session â€” that's intentional.

## Process supervision (systemd)

`/etc/systemd/system/feedback-api.service`:

```ini
[Unit]
Description=Feedback API
After=network.target postgresql.service

[Service]
User=feedback
WorkingDirectory=/opt/feedback-prototype/apps/api
EnvironmentFile=/opt/feedback-prototype/apps/api/.env
ExecStart=/usr/local/bin/bun run src/server.ts
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/feedback-dashboard.service`:

```ini
[Unit]
Description=Feedback Dashboard
After=network.target feedback-api.service

[Service]
User=feedback
WorkingDirectory=/opt/feedback-prototype/apps/dashboard
EnvironmentFile=/opt/feedback-prototype/apps/dashboard/.env.production
Environment=PORT=3000
ExecStart=/usr/local/bin/bun run start
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now feedback-api feedback-dashboard
```

## Reverse proxy (Caddy)

```caddyfile
feedback.example.com {
  encode zstd gzip

  # Dashboard
  reverse_proxy /api/* 127.0.0.1:8787 {
    header_up Host {host}
  }
  reverse_proxy * 127.0.0.1:3000
}
```

The `/api/*` prefix is what `NEXT_PUBLIC_FEEDBACK_API_URL` should point at. Adjust both consistently â€” the SDK in a prototype uses the public URL, the dashboard reads internally over `FEEDBACK_API_URL=http://127.0.0.1:8787`.

## SDK in a prototype

```ts
import { initFeedback } from '@mahmulp/feedback-sdk'

initFeedback({
  apiUrl: 'https://feedback.example.com/api',
  projectId: 'prototype-a',
})
```

Make sure the prototype's origin is in the API's `ALLOWED_ORIGINS`.

## Backups

The system has two pieces of state. Back them up together:

1. **PostgreSQL** â€” `pg_dump "$DATABASE_URL" > feedback-$(date +%F).sql`
2. **Storage directory** â€” `tar czf screenshots-$(date +%F).tgz -C /var/lib/feedback screenshots`

A weekly cron with both is the minimum bar.

## Health checks

- API: `GET /health` â†’ `{"ok":true}`
- Dashboard: `GET /` â†’ 307 redirect to `/projects` (or `/login` when auth is configured)

Hook these into your uptime monitor.

## Upgrading

```bash
git pull
bun install
bun run build:sdk
bun --filter @mahmulp/dashboard build
psql "$DATABASE_URL" -f apps/api/drizzle/<latest>.sql   # if a new migration shipped
sudo systemctl restart feedback-api feedback-dashboard
```

`SESSION_SECRET` need not change on upgrade â€” bump it only when you want to forcibly sign every reviewer out.
