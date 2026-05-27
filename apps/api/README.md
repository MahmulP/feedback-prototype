# @mahmulp/api

Backend for the feedback platform. **Hono on Bun**, **PostgreSQL via Drizzle** (with an in-memory fallback for local dev), and **local-disk storage** for screenshots — no S3 / R2 / MinIO required.

This README focuses on running the API. For the bigger picture (SDK + dashboard) see the [repo root README](../../README.md).

## Quick start

```bash
# from the repo root
bun install

# from this folder
cp .env.example .env       # fill in DATABASE_URL + SESSION_SECRET (see below)
bun run dev                # hot-reload server on :8787
```

Health check: <http://localhost:8787/health> → `{"ok":true}`.

## Configuration

Environment is validated by `src/env.ts`. The API refuses to boot on invalid values.

| Variable                   | Required        | Notes |
| -------------------------- | --------------- | ----- |
| `PORT`                     | optional        | Defaults to `8787`. |
| `STORAGE_DIR`              | optional        | Where screenshots are written. Defaults to `./data/screenshots`. The directory is created on startup if missing. |
| `ALLOWED_ORIGINS`          | optional        | Comma-separated CORS origins. Use `*` only for local dev. |
| `DATABASE_URL`             | optional        | When unset, the API uses an in-memory store (data lost on restart). Set it to switch to PostgreSQL. URL-encode special characters in the password (`!` → `%21`, etc.). |
| `SESSION_SECRET`           | required (prod) | HMAC key for the dashboard cookie session. 32+ random bytes. Generate with `openssl rand -hex 32`. In dev, a fallback is used so the API can boot. |
| `RATE_LIMIT_INGEST_PER_MIN`| optional        | Per-key bucket on SDK ingest endpoints. Defaults to `60`. |
| `LOG_LEVEL`                | optional        | `debug` / `info` / `warn` / `error`. Defaults to `info`. |

### Sample `.env`

```ini
PORT=8787
STORAGE_DIR=./data/screenshots
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

DATABASE_URL=postgres://postgres:Init123%21@localhost:5432/sigma_prototype
SESSION_SECRET=replace-with-32-bytes-random

RATE_LIMIT_INGEST_PER_MIN=60
LOG_LEVEL=info
```

## PostgreSQL setup

If you want persistence, provision Postgres (any 14+ instance works). With Docker:

```bash
docker run -d --name fbpg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=Init123! \
  -e POSTGRES_DB=sigma_prototype \
  -p 5432:5432 postgres:16
```

Apply migrations from this folder:

```bash
bun run migrate
```

That runs every `*.sql` in `drizzle/` in order, recording applied files in a `_drizzle_migrations` ledger so reruns are idempotent.

To roll out new schema changes later:

1. Edit `src/db/schema.ts`.
2. Generate the migration: `bunx drizzle-kit generate`.
3. Commit the new file in `drizzle/`.
4. Operators run `bun run migrate` on deploy.

## Routes

All routes are under `/v1/...`. JSON in, JSON out (except the screenshot stream).

| Method | Path                                | Auth | Purpose |
| ------ | ----------------------------------- | ---- | ------- |
| GET    | `/health`                           | —    | Liveness probe |
| POST   | `/v1/auth/signup`                   | —    | Create dashboard user (sets cookie) |
| POST   | `/v1/auth/login`                    | —    | Sign in (sets cookie) |
| POST   | `/v1/auth/logout`                   | —    | Clears cookie |
| GET    | `/v1/auth/me`                       | user | Current user |
| GET    | `/v1/projects`                      | user | List your projects with feedback counters |
| POST   | `/v1/projects`                      | user | Create project |
| GET    | `/v1/projects/:slug`                | user | Project detail |
| PATCH  | `/v1/projects/:slug`                | user | Update name/description/origins |
| DELETE | `/v1/projects/:slug`                | user | Delete project (cascades) |
| GET    | `/v1/projects/:slug/keys`           | user | List API keys (no plaintext) |
| POST   | `/v1/projects/:slug/keys`           | user | Issue new key (plaintext **shown once**) |
| DELETE | `/v1/projects/:slug/keys/:keyId`    | user | Revoke key |
| GET    | `/v1/projects/:slug/feedback`       | user | List feedback for a project |
| GET    | `/v1/feedback/:id`                  | user | Feedback detail |
| PATCH  | `/v1/feedback/:id`                  | user | Change status |
| POST   | `/v1/feedback/:id/comments`         | user or key | Append to thread |
| GET    | `/v1/feedback`                      | key  | SDK list (scoped by key's project) |
| POST   | `/v1/feedback`                      | key  | SDK create pin |
| PATCH  | `/v1/feedback/:id/coordinates`      | key  | SDK move (drag) |
| POST   | `/v1/feedback/:id/screenshot`       | key  | SDK upload screenshot (PNG/JPEG/WebP, ≤ 5 MB) |
| GET    | `/v1/feedback/:id/screenshot`       | —    | Public stream of stored screenshot |

**Auth = `user`** means a valid cookie session.
**Auth = `key`** means an `x-feedback-key` header with a project's plaintext API key.

Errors follow `{ error: { code, message } }`. Status codes: `400` validation, `401` missing auth, `403` wrong project, `404` not found, `413` payload too large, `429` rate limited, `500` internal.

## Storage

Screenshots are written to `STORAGE_DIR/screenshots/{feedbackId}.{ext}`. Path traversal and unusual characters are rejected at the driver level. MIME is verified by magic bytes; the `Content-Type` header is not trusted.

Backups: the system has two pieces of state — the Postgres database and the `STORAGE_DIR`. Back them up together. See `docs/deployment.md` for a sample backup script.

## Tests

```bash
bun run test         # vitest, in-memory store, 25 tests
bun run typecheck
```

The full E2E smoke (signup → project → key → ingest → read → screenshot) lives at `scripts/e2e-smoke.ts` in the repo root. Start the API in one terminal, then:

```bash
bun run smoke   # from repo root
```

## Files

```
apps/api/
├── drizzle/                    SQL migrations (ordered)
├── scripts/migrate.ts          migration runner
└── src/
    ├── server.ts               Bun entry
    ├── app.ts                  route registration
    ├── env.ts                  zod-validated env
    ├── auth.ts                 cookie session + project key middleware
    ├── session.ts              HMAC sign/verify
    ├── password.ts             Argon2id (Bun) / PBKDF2 (Node) fallback
    ├── store.ts                FeedbackStore interface + in-memory impl
    ├── db/                     Drizzle schema + Postgres-backed store
    ├── storage.ts              local-disk screenshot driver
    ├── rate-limit.ts           per-key token bucket
    ├── logger.ts               structured JSON request logging
    └── schemas.ts              zod validation schemas
```
