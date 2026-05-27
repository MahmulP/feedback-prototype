# @mahmulp/api

Self-hosted backend for the feedback platform. Hono on Bun, PostgreSQL (optional, via Drizzle), local filesystem storage.

## Run

```bash
# from the repo root
bun install
cp apps/api/.env.example apps/api/.env

# from this folder
bun run dev    # http://localhost:8787
```

By default the API uses an **in-memory store** (data lost on restart) so the SDK can talk to a real backend without any setup. Set `DATABASE_URL` to switch to PostgreSQL persistence.

## Routes

| Method | Path                                  | Purpose                                       |
| ------ | ------------------------------------- | --------------------------------------------- |
| GET    | `/health`                             | Liveness probe                                |
| GET    | `/v1/projects`                        | List projects with open / total counters     |
| GET    | `/v1/feedback?projectId=â€¦`            | List feedback for a project (filterable)      |
| GET    | `/v1/feedback/:id`                    | Get a single feedback                         |
| POST   | `/v1/feedback`                        | Create a new pin                              |
| POST   | `/v1/feedback/:id/comments`           | Append a comment to the thread                |
| PATCH  | `/v1/feedback/:id`                    | Change status (`open` / `resolved` / `archived`) |
| POST   | `/v1/feedback/:id/screenshot`         | Upload a screenshot (PNG / JPEG / WebP, â‰¤ 5 MB) |
| GET    | `/v1/feedback/:id/screenshot`         | Stream the stored screenshot                  |

## Storage layout

Screenshots live under `${STORAGE_DIR}/screenshots/{feedbackId}.{ext}`. Path traversal and unusual characters are rejected at the driver level. MIME is verified by magic bytes; the `Content-Type` header is not trusted.

## PostgreSQL persistence (optional)

1. Provision a Postgres database and set `DATABASE_URL` (`postgres://â€¦`).
2. Apply the schema:
   ```bash
   psql "$DATABASE_URL" -f drizzle/0000_initial.sql
   ```
   â€¦or, if you've installed `drizzle-kit`:
   ```bash
   bunx drizzle-kit migrate
   ```
3. Restart the API. It will log `using PostgreSQL store` on startup.

The Drizzle schema lives in `src/db/schema.ts`. Regenerate migrations after schema changes with `bunx drizzle-kit generate`.

## Env

See `.env.example` for all variables. The schema in `src/env.ts` is the source of truth â€” the API refuses to boot if validation fails.
