import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { attempts, studentCourses } from "../db/schema";

export type StudentCourseRow = typeof studentCourses.$inferSelect;
export type NewStudentCourse = Omit<typeof studentCourses.$inferInsert, "id" | "userId">;
export type StudentCoursePatch = Partial<
  Pick<NewStudentCourse, "title" | "credits" | "category" | "excluded">
>;

/** Student courses of one user. Every function is bound to `ownerId`; another user's id finds nothing. */
export function studentCoursesRepo(db: Db, ownerId: number) {
  const mine = (id: number) => and(eq(studentCourses.id, id), eq(studentCourses.userId, ownerId));
  return {
    /** In the order they were added, which is the order they fill elective slots. */
    async listOwn(): Promise<StudentCourseRow[]> {
      return db
        .select()
        .from(studentCourses)
        .where(eq(studentCourses.userId, ownerId))
        .orderBy(asc(studentCourses.createdAt), asc(studentCourses.id))
        .all();
    },
    async findOwn(id: number): Promise<StudentCourseRow | null> {
      return (await db.select().from(studentCourses).where(mine(id)).get()) ?? null;
    },
    /** Throws on a duplicate code (unique per user), so a race past the route's check cannot add two. */
    async create(row: NewStudentCourse): Promise<StudentCourseRow> {
      return db
        .insert(studentCourses)
        .values({ ...row, userId: ownerId })
        .returning()
        .get();
    },
    async update(id: number, patch: StudentCoursePatch): Promise<StudentCourseRow | null> {
      return (await db.update(studentCourses).set(patch).where(mine(id)).returning().get()) ?? null;
    },
    /** Deletes the course and its attempts together in one batch. Returns false when it is not the owner's. */
    async deleteOwn(id: number): Promise<boolean> {
      const row = await this.findOwn(id);
      if (!row) return false;
      await db.batch([
        db
          .delete(attempts)
          .where(and(eq(attempts.userId, ownerId), eq(attempts.courseCode, row.code))),
        db.delete(studentCourses).where(mine(id)),
      ]);
      return true;
    },
  };
}
