import { and, asc, eq, gt, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/client";
import { faculty } from "../db/schema";
import { parseFacultyQuery } from "../../shared/facultySearch";
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

export type FacultyListParams = {
  /** Rows to return; the caller asks for one more than a page to learn whether another follows. */
  limit: number;
  /** The id of the last row of the previous page, or null for the first page. */
  cursor: number | null;
  /** Typed search over names and initials; empty means the whole directory. */
  query?: string;
  /** A department code; undefined means all. */
  department?: string;
  /** Mods can list hidden rows too; the student picker never does. */
  includeHidden?: boolean;
};

/**
 * The name as lowercase words with a space in front: the punctuation NSU prints in names (dots,
 * brackets, hyphens, commas, apostrophes) becomes a space, so a word that starts a name word is a
 * `LIKE '% word%'`.
 * ceiling: SQL lowercases only ASCII and folds no accents, so a mod-added name with accented letters
 * is matched only by a query typed with the same accents. All seeded names are ASCII. Revisit with a
 * stored search column if accented names become common.
 * ceiling: a search reads every faculty row (about a thousand), as the one-off download did, but once
 * per typed term instead of once per hour per browser. Revisit with a stored search column or FTS5 if
 * the directory grows to many thousands.
 */
const nameWords = sql`' ' || lower(replace(replace(replace(replace(replace(replace(${faculty.name}, '.', ' '), '(', ' '), ')', ' '), '-', ' '), ',', ' '), '''', ' '))`;

/**
 * The search as SQL: a `where` every matching row passes and a rank (0 exact initials, 1 initials
 * prefix, 2 a name match) to order by. Each is null when the search does not need it. Reads a query
 * the way `parseFacultyQuery` describes.
 */
function searchParts(query: string): { where: SQL | null; rank: SQL | null } {
  const { words, initials } = parseFacultyQuery(query);
  const used = words.slice(0, limits.facultySearch.maxWords);
  const rank =
    initials === ""
      ? null
      : sql`(CASE WHEN lower(${faculty.initials}) = ${initials} THEN 0 WHEN lower(${faculty.initials}) LIKE ${`${initials}%`} THEN 1 ELSE 2 END)`;
  if (used.length === 0) return { where: null, rank };
  // Words hold only letters and digits, so they carry no LIKE wildcard.
  const byName = and(...used.map((w) => sql`${nameWords} LIKE ${`% ${w}%`}`)) ?? null;
  return { where: rank && byName ? (or(sql`${rank} < 2`, byName) ?? null) : byName, rank };
}

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
    /**
     * One page of the directory ordered by rank (when searching), name, then id, so the id of the last
     * row is a stable keyset cursor. Null when the cursor names no row. Hidden rows are left out
     * unless `includeHidden`.
     */
    async listPage(p: FacultyListParams): Promise<FacultyRow[] | null> {
      const { where: match, rank } = searchParts(p.query ?? "");
      let after: SQL | undefined;
      if (p.cursor !== null) {
        const last = await db
          .select({ name: faculty.name, rank: rank ?? sql<number>`0` })
          .from(faculty)
          .where(eq(faculty.id, p.cursor))
          .get();
        if (!last) return null;
        const byName = or(
          gt(faculty.name, last.name),
          and(eq(faculty.name, last.name), gt(faculty.id, p.cursor)),
        );
        after = rank
          ? or(sql`${rank} > ${last.rank}`, and(sql`${rank} = ${last.rank}`, byName))
          : byName;
      }
      return db
        .select()
        .from(faculty)
        .where(
          and(
            p.includeHidden ? undefined : eq(faculty.hidden, false),
            p.department === undefined ? undefined : eq(faculty.department, p.department),
            match ?? undefined,
            after,
          ),
        )
        .orderBy(...(rank ? [rank] : []), asc(faculty.name), asc(faculty.id))
        .limit(p.limit)
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
