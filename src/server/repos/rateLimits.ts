import { sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { rateLimits } from "../db/schema";

export function rateLimitsRepo(db: Db) {
  return {
    /** Adds one hit to the key's window and returns the new count. One atomic upsert, never read-then-write. */
    async hit(key: string, windowStart: number): Promise<number> {
      const row = await db
        .insert(rateLimits)
        .values({ key, windowStart, count: 1 })
        .onConflictDoUpdate({
          target: [rateLimits.key, rateLimits.windowStart],
          set: { count: sql`${rateLimits.count} + 1` },
        })
        .returning({ count: rateLimits.count })
        .get();
      return row.count;
    },
  };
}
