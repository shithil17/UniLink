import { and, asc, eq, getTableColumns, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { courses, curricula } from "../db/schema";
import { limits } from "../limits";

export type CurriculumRow = typeof curricula.$inferSelect;
export type CourseRow = typeof courses.$inferSelect;
export type NewCourse = Omit<typeof courses.$inferInsert, "id" | "curriculumId">;
/** The columns an edit or a hide changes: what a before-snapshot holds and a reversal puts back. */
export type CourseState = Pick<
  CourseRow,
  | "kind"
  | "code"
  | "title"
  | "credits"
  | "category"
  | "nonCredit"
  | "semester"
  | "alternatives"
  | "prereq"
  | "hidden"
>;
export type CoursePatch = Partial<Omit<CourseState, "hidden">>;
export type CourseWrite = { ok: true; row: CourseRow } | { ok: false; conflict: "code_taken" };
export type CurriculumHeader = Pick<
  typeof curricula.$inferInsert,
  "programCode" | "name" | "version" | "effectiveFromYear" | "totalCredits"
>;

/** True if a unique-index failure on a course code is anywhere in the error chain. */
export function courseCodeConflictOf(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (e.message.includes("courses.curriculum_id, courses.code")) return true;
  }
  return false;
}

/** Runs a write and turns a duplicate slot code into a named conflict. */
async function guarded(write: () => Promise<CourseRow | undefined>): Promise<CourseWrite | null> {
  try {
    const row = await write();
    return row ? { ok: true, row } : null;
  } catch (err) {
    if (courseCodeConflictOf(err)) return { ok: false, conflict: "code_taken" };
    throw err;
  }
}

export function curriculaRepo(db: Db) {
  return {
    /** Every imported curriculum with its slot count, for the mod Courses screen. A handful of rows. */
    async listWithCounts(): Promise<(CurriculumRow & { courseCount: number })[]> {
      return db
        .select({ ...getTableColumns(curricula), courseCount: sql<number>`count(${courses.id})` })
        .from(curricula)
        .leftJoin(courses, eq(courses.curriculumId, curricula.id))
        .groupBy(curricula.id)
        .orderBy(asc(curricula.programCode), asc(curricula.effectiveFromYear))
        .all();
    },
    async findById(id: number): Promise<CurriculumRow | null> {
      return (await db.select().from(curricula).where(eq(curricula.id, id)).get()) ?? null;
    },
    async findCourse(id: number): Promise<CourseRow | null> {
      return (await db.select().from(courses).where(eq(courses.id, id)).get()) ?? null;
    },
    /** Code and title by id, hidden slots included, so the audit log can name what a row changed. */
    async courseLabelsByIds(ids: readonly number[]) {
      const labels = new Map<number, { code: string; title: string }>();
      for (let i = 0; i < ids.length; i += limits.d1MaxBoundParams) {
        const rows = await db
          .select({ id: courses.id, code: courses.code, title: courses.title })
          .from(courses)
          .where(inArray(courses.id, ids.slice(i, i + limits.d1MaxBoundParams)))
          .all();
        for (const r of rows) labels.set(r.id, { code: r.code, title: r.title });
      }
      return labels;
    },
    /** Adds a slot after the curriculum's last one, visible. A code already used as a slot code is a conflict. */
    async addCourse(curriculumId: number, row: Omit<CourseState, "hidden">): Promise<CourseWrite> {
      const written = await guarded(() =>
        db
          .insert(courses)
          .values({
            ...row,
            curriculumId,
            position: sql`(SELECT coalesce(max(position), -1) + 1 FROM courses WHERE curriculum_id = ${curriculumId})`,
          })
          .returning()
          .get(),
      );
      if (!written) throw new Error("course insert returned no row");
      return written;
    },
    /** Null when the row does not exist. */
    async updateCourse(id: number, patch: CoursePatch): Promise<CourseWrite | null> {
      return guarded(() =>
        db.update(courses).set(patch).where(eq(courses.id, id)).returning().get(),
      );
    },
    /** Flips the flag. Null when the row is missing or already in that state. */
    async setCourseHidden(id: number, hidden: boolean): Promise<CourseRow | null> {
      return (
        (await db
          .update(courses)
          .set({ hidden })
          .where(and(eq(courses.id, id), ne(courses.hidden, hidden)))
          .returning()
          .get()) ?? null
      );
    },
    /** The update that puts a snapshot back (not run here, so a reversal can batch it with its audit row). */
    restoreCourseStatement(id: number, snapshot: Partial<CourseState>) {
      return db.update(courses).set(snapshot).where(eq(courses.id, id));
    },
    /** Every version imported for one program (a handful of rows). */
    async listByProgram(programCode: string): Promise<CurriculumRow[]> {
      return db.select().from(curricula).where(eq(curricula.programCode, programCode)).all();
    },
    async findByProgramVersion(
      programCode: string,
      version: string,
    ): Promise<CurriculumRow | null> {
      return (
        (await db
          .select()
          .from(curricula)
          .where(and(eq(curricula.programCode, programCode), eq(curricula.version, version)))
          .get()) ?? null
      );
    },
    /** Creates the curriculum, or updates the header of the one with the same program and version. */
    async upsert(header: CurriculumHeader, now: number): Promise<CurriculumRow> {
      return db
        .insert(curricula)
        .values({ ...header, createdAt: now })
        .onConflictDoUpdate({
          target: [curricula.programCode, curricula.version],
          set: {
            name: header.name,
            effectiveFromYear: header.effectiveFromYear,
            totalCredits: header.totalCredits,
          },
        })
        .returning()
        .get();
    },
    async listCourses(curriculumId: number): Promise<CourseRow[]> {
      return db
        .select()
        .from(courses)
        .where(eq(courses.curriculumId, curriculumId))
        .orderBy(asc(courses.position), asc(courses.id))
        .all();
    },
    async countCourses(curriculumId: number): Promise<number> {
      const row = await db
        .select({ n: sql<number>`count(*)` })
        .from(courses)
        .where(eq(courses.curriculumId, curriculumId))
        .get();
      return row?.n ?? 0;
    },
    /** Swaps all the curriculum's courses for `rows` in one D1 batch, so a failure leaves the old ones. */
    async replaceCourses(curriculumId: number, rows: NewCourse[]): Promise<void> {
      const perStatement = Math.floor(
        limits.d1MaxBoundParams / Object.keys(getTableColumns(courses)).length,
      );
      const inserts = [];
      for (let i = 0; i < rows.length; i += perStatement) {
        inserts.push(
          db
            .insert(courses)
            .values(rows.slice(i, i + perStatement).map((r) => ({ ...r, curriculumId }))),
        );
      }
      await db.batch([
        db.delete(courses).where(eq(courses.curriculumId, curriculumId)),
        ...inserts,
      ]);
    },
  };
}
