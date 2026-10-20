import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "../db/client";
import { faculty } from "../db/schema";
import { limits } from "../limits";

export type FacultyRow = typeof faculty.$inferSelect;
export type NewFaculty = Pick<
  typeof faculty.$inferInsert,
  "name" | "initials" | "designation" | "department" | "nsuPage"
>;
export type FacultyPatch = Partial<NewFaculty>;
/** The columns an edit or a hide changes: what a before-snapshot holds and a reversal puts back. */
export type FacultyState = Pick<
  FacultyRow,
  "name" | "initials" | "designation" | "department" | "nsuPage" | "hidden"
>;

export type FacultyConflict = "initials_taken" | "name_taken";
export type FacultyWrite = { ok: true; row: FacultyRow } | { ok: false; conflict: FacultyConflict };

/** What the student picker needs, and no more. */
const optionColumns = {
  id: faculty.id,
  name: faculty.name,
  initials: faculty.initials,
  designation: faculty.designation,
  department: faculty.department,
};

/** Which unique index a D1 error names, anywhere in its cause chain; null for any other error. */
export function facultyConflictOf(err: unknown): FacultyConflict | null {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (e.message.includes("faculty_initials_idx")) return "initials_taken";
    if (e.message.includes("faculty.name, faculty.department")) return "name_taken";
  }
  return null;
}

/** Runs a write and turns a unique-index failure into a named conflict. */
async function guarded(write: () => Promise<FacultyRow | undefined>): Promise<FacultyWrite | null> {
  try {
    const row = await write();
    return row ? { ok: true, row } : null;
  } catch (err) {
    const conflict = facultyConflictOf(err);
    if (conflict) return { ok: false, conflict };
    throw err;
  }
}

/** Faculty are public reference data, so these reads are not scoped to a user. */
export function facultyRepo(db: Db) {
  return {
    /** Visible faculty by name, capped at `limits.facultyListMax`. Hidden rows never appear. */
    async listVisible() {
      return db
        .select(optionColumns)
        .from(faculty)
        .where(eq(faculty.hidden, false))
        .orderBy(asc(faculty.name))
        .limit(limits.facultyListMax)
        .all();
    },
    /** Every row, hidden ones included, for the moderator panel. */
    async listAll(): Promise<FacultyRow[]> {
      return db
        .select()
        .from(faculty)
        .orderBy(asc(faculty.name))
        .limit(limits.facultyListMax)
        .all();
    },
    async findById(id: number): Promise<FacultyRow | null> {
      return (await db.select().from(faculty).where(eq(faculty.id, id)).get()) ?? null;
    },
    /** True for a hidden row too: an attempt may keep pointing at faculty that left the picker. */
    async exists(id: number): Promise<boolean> {
      const row = await db.select({ id: faculty.id }).from(faculty).where(eq(faculty.id, id)).get();
      return row !== undefined;
    },
    /** Name and initials by id, hidden rows included, so an attempt row can still say who taught it. */
    async labelsByIds(ids: readonly number[]) {
      const labels = new Map<number, { name: string; initials: string | null }>();
      for (let i = 0; i < ids.length; i += limits.d1MaxBoundParams) {
        const rows = await db
          .select({ id: faculty.id, name: faculty.name, initials: faculty.initials })
          .from(faculty)
          .where(inArray(faculty.id, ids.slice(i, i + limits.d1MaxBoundParams)))
          .all();
        for (const r of rows) labels.set(r.id, { name: r.name, initials: r.initials });
      }
      return labels;
    },
    /** Adds a visible row; a name taken in that department or initials taken anywhere is a conflict. */
    async create(input: NewFaculty): Promise<FacultyWrite> {
      const written = await guarded(() => db.insert(faculty).values(input).returning().get());
      if (!written) throw new Error("faculty insert returned no row");
      return written;
    },
    /** Null when the row does not exist. */
    async update(id: number, patch: FacultyPatch): Promise<FacultyWrite | null> {
      return guarded(() =>
        db.update(faculty).set(patch).where(eq(faculty.id, id)).returning().get(),
      );
    },
    /** Flips the flag. Null when the row is missing or already in that state. */
    async setHidden(id: number, hidden: boolean): Promise<FacultyRow | null> {
      return (
        (await db
          .update(faculty)
          .set({ hidden })
          .where(and(eq(faculty.id, id), ne(faculty.hidden, hidden)))
          .returning()
          .get()) ?? null
      );
    },
    /** The update that puts a snapshot back (not run here, so a reversal can batch it with its audit row). */
    restoreStatement(id: number, snapshot: Partial<FacultyState>) {
      return db.update(faculty).set(snapshot).where(eq(faculty.id, id));
    },
  };
}
