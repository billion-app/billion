import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

let _db: NodePgDatabase<typeof schema> | null = null;

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      if (!process.env.POSTGRES_URL) {
        throw new Error("Missing POSTGRES_URL");
      }
      _db = drizzle(process.env.POSTGRES_URL, {
        schema,
        casing: "snake_case",
      });
    }
    return Reflect.get(_db, prop) as unknown;
  },
});
