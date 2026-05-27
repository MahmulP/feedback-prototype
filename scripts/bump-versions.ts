/**
 * Bump every workspace package.json to a new version, in lockstep.
 *
 *   bun run scripts/bump-versions.ts 0.2.0
 *
 * - Skips the SvelteKit example (kept at 0.0.0 by design).
 * - Skips packages with `"private": true` *only* for the npm publish step;
 *   their version still moves so internal references stay consistent.
 * - Leaves `workspace:*` internal dependency specifiers alone (Bun resolves
 *   them at install time). Only `version` fields are touched.
 *
 * This script is intentionally dependency-free so it can run inside CI
 * without a bun install step on the workflow root.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TARGETS = [
  "package.json",
  "apps/api/package.json",
  "apps/dashboard/package.json",
  "packages/shared-types/package.json",
  "packages/feedback-sdk/package.json",
];

function assertSemver(v: string): asserts v is string {
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(v)) {
    throw new Error(`not a valid semver: "${v}"`);
  }
}

async function bumpFile(rel: string, version: string): Promise<boolean> {
  const full = path.resolve(process.cwd(), rel);
  let raw: string;
  try {
    raw = await readFile(full, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.warn(`[bump] skip ${rel} (not found)`);
      return false;
    }
    throw err;
  }
  const json = JSON.parse(raw) as { name?: string; version?: string };
  if (json.version === version) {
    console.log(`[bump] ${rel} already at ${version}`);
    return false;
  }
  // Preserve trailing newline + indentation by replacing only the version line.
  // Falls back to a structured rewrite if the regex doesn't match.
  const versionLine = /("version"\s*:\s*")([^"]+)(")/;
  let next: string;
  if (versionLine.test(raw)) {
    next = raw.replace(versionLine, `$1${version}$3`);
  } else {
    json.version = version;
    next = JSON.stringify(json, null, 2) + "\n";
  }
  await writeFile(full, next, "utf8");
  console.log(`[bump] ${rel}: ${json.version ?? "<none>"} → ${version}`);
  return true;
}

async function main() {
  const version = process.argv[2];
  if (!version) {
    console.error("usage: bun run scripts/bump-versions.ts <semver>");
    process.exit(2);
  }
  assertSemver(version);

  let changed = 0;
  for (const file of TARGETS) {
    if (await bumpFile(file, version)) changed++;
  }
  console.log(`[bump] updated ${changed} file(s) to ${version}`);
}

main().catch((err) => {
  console.error("[bump] failed:", err);
  process.exit(1);
});
