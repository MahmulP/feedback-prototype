---
inclusion: fileMatch
fileMatchPattern: 'apps/api/**'
---

# API Conventions

Apply these rules whenever working inside `apps/api/`.

## Framework
Default to **Hono** running on Bun. If something pushes us toward Elysia later, that's a deliberate decision documented in a spec — don't switch silently.

## Route shape
- Versioned under `/v1/...`.
- JSON in, JSON out. No HTML responses except for health endpoints and direct screenshot file serving.
- Standard error shape:
  ```json
  { "error": { "code": "feedback_not_found", "message": "…" } }
  ```
- HTTP status codes follow the obvious mapping: 400 validation, 401 missing auth, 403 wrong project, 404 not found, 409 conflict, 422 semantic validation, 500 server.

## Auth
- **SDK ingest** uses a per-project API key sent as `x-feedback-key`. Keys are scoped to one project and have no implicit dashboard permissions.
- **Dashboard users** authenticate via cookie session (signed, HttpOnly, SameSite=Lax).
- Never accept a project API key as a dashboard credential and vice versa. Mixing the two is a security bug.

## Validation
- Validate every request body and query with **zod** (or the chosen schema library). Validation lives at the route boundary; downstream code can trust shapes.
- Reuse the wire types from `packages/shared-types`; the zod schemas are the runtime mirror of those types.

## Database
- **PostgreSQL** with **Drizzle ORM**. Migrations live under `apps/api/drizzle/` and are checked into the repo.
- All queries that return user-facing lists must be paginated. Default page size 50, max 200.
- Soft-delete feedback (`status = "archived"`) rather than hard-delete by default.

## Storage (local filesystem only)
v1 stores screenshot files on the API host's **local filesystem**. There is no S3, R2, or MinIO. Treat storage as a service-level dependency on the host disk.

- Configure a single env var, `STORAGE_DIR` (default `./data/screenshots`). The API creates the directory at startup if missing.
- Files are written as `STORAGE_DIR/{feedbackId}.png`. The DB stores the relative key (`screenshots/{feedbackId}.png`), not the absolute path, so the directory can be moved between deployments.
- Wrap all filesystem access behind a small `StorageDriver` interface (`put`, `get`, `delete`, `exists`). The v1 implementation is `LocalDiskDriver`; routes never call `fs` directly. This keeps the door open for future drivers without forcing one into v1.
- **Path safety:** never let a client-supplied string flow into a filesystem path. Always derive the path from a server-issued feedback ID. Reject any key containing `..`, `/`, `\`, or null bytes.
- **File limits:** enforce a max upload size (default 5 MB) and a strict allowlist of MIME types (`image/png`, `image/jpeg`, `image/webp`). Verify the magic bytes server-side, not just the `Content-Type` header.
- Set restrictive permissions on the storage directory (e.g. `0700` on Unix). Document this in the deployment guide.

### Upload flow
1. SDK sends `POST /v1/feedback` with the JSON metadata. The API issues a feedback ID and returns it.
2. SDK uploads the PNG with `POST /v1/feedback/{id}/screenshot` as `multipart/form-data` (field name `file`). The API validates, writes to disk, and updates the DB row with the storage key.
3. Dashboard reads via `GET /v1/feedback/{id}/screenshot`, which streams the file from disk with appropriate cache headers. This endpoint requires a valid dashboard session.
4. There is no signed URL flow in v1 — uploads and reads always go through the API process. This is fine because we are local-only.

## Logging & errors
- Structured logs (JSON) with at minimum: `method`, `path`, `status`, `durationMs`, `requestId`, `projectId` (when known).
- Catch and log every unhandled error before responding 500. Never leak stack traces to clients.
- Disk errors (ENOSPC, EACCES, ENOENT on read) get their own log category and a user-friendly error message.

## Rate limiting
- The ingest endpoints (`POST /v1/feedback`, screenshot upload) must be rate-limited per project key. Start with a conservative default (e.g. 60 req/min/key) and make it configurable per deployment.
- Screenshot uploads also have a per-key bandwidth cap (default 10 MB/min) so a misbehaving SDK can't fill the disk.

## CORS
- Configurable per project: each project record stores an `allowedOrigins` list. The SDK ingest endpoints check the request origin against that list.
- Dashboard endpoints accept only the dashboard origin.

## Backups & retention
- Screenshots are part of the application's data. The deployment guide must remind operators to back up `STORAGE_DIR` together with the Postgres dump.
- Provide a CLI/admin task to delete orphaned files (DB row missing) on a schedule. Never auto-delete on the request path.

## Testing
- Integration tests run the API against a real Postgres (use Bun's test runner with a docker-compose db, or testcontainers). Use a temp directory for `STORAGE_DIR`.
- Each route has at least one happy-path test and one auth-failure test.
- Storage tests cover path-traversal rejection and MIME validation explicitly.
- Use `vitest --run` (or `bun test`) in automation; never start a watcher.
