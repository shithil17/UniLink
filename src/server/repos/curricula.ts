import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { courses, curricula } from "../db/schema";
import { limits } from "../limits";

export type CurriculumRow = typeof curricula.$inferSelect;
export type CourseRow = typeof courses.$inferSelect;
export type NewCourse = Omit<typeof courses.$inferInsert, "id" | "curriculumId">;
export type CurriculumHeader = Pick<
  typeof curricula.$inferInsert,
  "programCode" | "name" | "version" | "effectiveFromYear" | "totalCredits"
>;

export function curriculaRepo(db: Db) {
  return {
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
        .orderBy(asc(courses.position))
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
