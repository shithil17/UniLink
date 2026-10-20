import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { faculty } from "../db/schema";
import { limits } from "../limits";

export type FacultyRow = typeof faculty.$inferSelect;

/** Faculty are public reference data, so these reads are not scoped to a user. */
export function facultyRepo(db: Db) {
  return {
    /** By name, capped at `limits.facultyListMax`. */
    async list(): Promise<FacultyRow[]> {
      return db
        .select()
        .from(faculty)
        .orderBy(asc(faculty.name))
        .limit(limits.facultyListMax)
        .all();
    },
    async exists(id: number): Promise<boolean> {
      const row = await db.select({ id: faculty.id }).from(faculty).where(eq(faculty.id, id)).get();
      return row !== undefined;
    },
  };
}
