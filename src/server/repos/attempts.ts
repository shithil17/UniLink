import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { attempts } from "../db/schema";

export type AttemptRow = typeof attempts.$inferSelect;
export type NewAttempt = Omit<typeof attempts.$inferInsert, "id" | "userId">;
export type AttemptPatch = Partial<
  Pick<NewAttempt, "grade" | "termYear" | "termSeason" | "facultyId">
>;

/**
 * Attempts of one user. Every function is bound to `ownerId`, and there is deliberately no function
 * that reads another user's attempts: they are private, mods and admins included. Another user's
 * attempt id finds nothing.
 */
export function attemptsRepo(db: Db, ownerId: number) {
  const mine = (id: number) => and(eq(attempts.id, id), eq(attempts.userId, ownerId));
  return {
    async create(row: NewAttempt): Promise<AttemptRow> {
      return db
        .insert(attempts)
        .values({ ...row, userId: ownerId })
        .returning()
        .get();
    },
    /** Oldest first. With `courseCode`, only the attempts at that course. */
    async listOwn(courseCode?: string): Promise<AttemptRow[]> {
      return db
        .select()
        .from(attempts)
        .where(
          courseCode === undefined
            ? eq(attempts.userId, ownerId)
            : and(eq(attempts.userId, ownerId), eq(attempts.courseCode, courseCode)),
        )
        .orderBy(asc(attempts.id))
        .all();
    },
    async findOwn(id: number): Promise<AttemptRow | null> {
      return (await db.select().from(attempts).where(mine(id)).get()) ?? null;
    },
    async update(id: number, patch: AttemptPatch): Promise<AttemptRow | null> {
      return (await db.update(attempts).set(patch).where(mine(id)).returning().get()) ?? null;
    },
    /** False when the attempt does not exist or is not the owner's. */
    async deleteOwn(id: number): Promise<boolean> {
      const row = await db.delete(attempts).where(mine(id)).returning({ id: attempts.id }).get();
      return row !== undefined;
    },
  };
}
