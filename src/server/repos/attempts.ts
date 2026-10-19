import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { attempts } from "../db/schema";

export type AttemptRow = typeof attempts.$inferSelect;
export type NewAttempt = Omit<typeof attempts.$inferInsert, "id" | "userId">;

/**
 * Attempts of one user. Every function is bound to `ownerId`, and there is deliberately no function
 * that reads another user's attempts: they are private, mods and admins included.
 */
export function attemptsRepo(db: Db, ownerId: number) {
  return {
    async create(row: NewAttempt): Promise<AttemptRow> {
      return db
        .insert(attempts)
        .values({ ...row, userId: ownerId })
        .returning()
        .get();
    },
    async listOwn(): Promise<AttemptRow[]> {
      return db
        .select()
        .from(attempts)
        .where(eq(attempts.userId, ownerId))
        .orderBy(asc(attempts.id))
        .all();
    },
  };
}
