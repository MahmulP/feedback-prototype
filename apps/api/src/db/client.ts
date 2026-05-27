import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export interface DbHandle {
  db: DrizzleDb;
  raw: ReturnType<typeof postgres>;
  close(): Promise<void>;
}

export function createDb(connectionUrl: string): DbHandle {
  const raw = postgres(connectionUrl, {
    max: 8,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {},
  });
  const db = drizzle(raw, { schema });
  return {
    db,
    raw,
    async close() {
      await raw.end({ timeout: 5 });
    },
  };
}
