import { and, asc, count, eq } from "drizzle-orm";
import type { Term } from "../../shared/terms";
import type { Db } from "../db/client";
import { routineEntries } from "../db/schema";

export type RoutineRow = typeof routineEntries.$inferSelect;
export type NewRoutineRow = Omit<typeof routineEntries.$inferInsert, "id" | "userId">;
export type RoutinePatch = Partial<
  Pick<
    NewRoutineRow,
    "courseCode" | "section" | "days" | "startMinutes" | "endMinutes" | "room" | "facultyInitials"
  >
>;

/**
 * Routine entries of one user. Every function is bound to `ownerId`, and there is deliberately no
 * function that reads another user's entries: the routine is private, mods and admins included.
 * Another user's entry id finds nothing.
 */
export function routineRepo(db: Db, ownerId: number) {
  const mine = (id: number) => and(eq(routineEntries.id, id), eq(routineEntries.userId, ownerId));
  const inTerm = (term: Term) =>
    and(
      eq(routineEntries.userId, ownerId),
      eq(routineEntries.termYear, term.year),
      eq(routineEntries.termSeason, term.season),
    );
  return {
    async create(row: NewRoutineRow): Promise<RoutineRow> {
      return db
        .insert(routineEntries)
        .values({ ...row, userId: ownerId })
        .returning()
        .get();
    },
    /** One term, in the order they were added. */
    async listTerm(term: Term): Promise<RoutineRow[]> {
      return db
        .select()
        .from(routineEntries)
        .where(inTerm(term))
        .orderBy(asc(routineEntries.id))
        .all();
    },
    async countTerm(term: Term): Promise<number> {
      const row = await db.select({ n: count() }).from(routineEntries).where(inTerm(term)).get();
      return row?.n ?? 0;
    },
    async findOwn(id: number): Promise<RoutineRow | null> {
      return (await db.select().from(routineEntries).where(mine(id)).get()) ?? null;
    },
    async update(id: number, patch: RoutinePatch): Promise<RoutineRow | null> {
      return (await db.update(routineEntries).set(patch).where(mine(id)).returning().get()) ?? null;
    },
    /** False when the entry does not exist or is not the owner's. */
    async deleteOwn(id: number): Promise<boolean> {
      const row = await db
        .delete(routineEntries)
        .where(mine(id))
        .returning({ id: routineEntries.id })
        .get();
      return row !== undefined;
    },
    /** Deletes every entry of the term and returns how many there were. */
    async clearTerm(term: Term): Promise<number> {
      const rows = await db
        .delete(routineEntries)
        .where(inTerm(term))
        .returning({ id: routineEntries.id })
        .all();
      return rows.length;
    },
  };
}
