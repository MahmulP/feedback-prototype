import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

export interface DbHandle {
  db: DrizzleDb;
  /** Underlying connection — closed during graceful shutdown. */
  close(): Promise<void>;
}

export function createDb(connectionUrl: string): DbHandle {
  const client = postgres(connectionUrl, {
    max: 8,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {},
  });
  const db = drizzle(client, { schema });
  return {
    db,
    async close() {
      await client.end({ timeout: 5 });
    },
  };
}
