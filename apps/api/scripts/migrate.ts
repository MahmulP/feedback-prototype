/**
 * Tiny migration runner. Applies every `*.sql` file in `apps/api/drizzle/`
 * in lexical order, skipping ones already recorded in
 * `_drizzle_migrations`.
 *
 *   bun --filter @mahmulp/api migrate
 *
 * Honors `DATABASE_URL` from `apps/api/.env` (or the calling process env).
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

import { loadEnv } from "../src/env.js";

const MIGRATIONS_DIR = path.resolve(import.meta.dir, "..", "drizzle");

async function loadDotEnv(): Promise<void> {
  const apiEnvPath = path.resolve(import.meta.dir, "..", ".env");
  try {
    const file = Bun.file(apiEnvPath);
    if (!(await file.exists())) return;
    const text = await file.text();
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim();
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

async function main() {
  await loadDotEnv();
  const env = loadEnv();
  if (!env.DATABASE_URL) {
    console.error("[migrate] DATABASE_URL is not set; nothing to do.");
    process.exit(1);
  }

  const sql = postgres(env.DATABASE_URL, { onnotice: () => {} });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS "_drizzle_migrations" (
        "id" serial PRIMARY KEY,
        "name" text NOT NULL UNIQUE,
        "applied_at" timestamp with time zone NOT NULL DEFAULT now()
      )
    `;

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    if (files.length === 0) {
      console.log("[migrate] no .sql files found; nothing to do.");
      return;
    }

    const applied = await sql<{ name: string }[]>`SELECT name FROM "_drizzle_migrations"`;
    const appliedSet = new Set(applied.map((r) => r.name));

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[migrate] skip ${file} (already applied)`);
        continue;
      }
      const full = path.join(MIGRATIONS_DIR, file);
      const body = await readFile(full, "utf8");
      console.log(`[migrate] apply ${file}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`INSERT INTO "_drizzle_migrations" (name) VALUES (${file})`;
      });
    }
    console.log("[migrate] done.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
