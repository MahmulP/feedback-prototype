import { serve } from "@hono/node-server";
import { createAppFromEnv } from "./app.js";
import { loadEnv } from "./env.js";

async function main() {
  const env = loadEnv();
  const app = await createAppFromEnv(env);
  const port = env.PORT;
  serve({ fetch: app.fetch, port });
  console.log(`[api] listening on http://localhost:${port}`);
  console.log(`[api] storage dir: ${env.STORAGE_DIR}`);
}

main().catch((err) => {
  console.error("[api] failed to start:", err);
  process.exit(1);
});
