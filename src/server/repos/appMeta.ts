import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { appMeta } from "../db/schema";

export const DB_VERSION_KEY = "db_version";

export function appMetaRepo(db: Db) {
  return {
    async get(key: string): Promise<string | null> {
      const row = await db
        .select({ value: appMeta.value })
        .from(appMeta)
        .where(eq(appMeta.key, key))
        .get();
      return row?.value ?? null;
    },
  };
}
