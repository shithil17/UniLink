import type { Db } from "../../db/client";
import { curriculaRepo, type CourseRow, type CurriculumRow } from "../../repos/curricula";
import { studentCoursesRepo } from "../../repos/studentCourses";
import { usersRepo } from "../../repos/users";
import { attemptsRepo } from "../../repos/attempts";
import { activeCourses, courseCodes, pickCurriculum } from "./map";

export type LoadedCurriculum = {
  curriculum: CurriculumRow;
  /** The slots this student sees: hidden ones are left out unless they have an attempt on them. */
  courses: CourseRow[];
  /** Every slot, hidden ones included: codes there stay taken. */
  allCourses: CourseRow[];
};

/** The student's curriculum: their program (last two digits of the student ID suffix) and admission year. */
export async function loadCurriculum(db: Db, userId: number): Promise<LoadedCurriculum | null> {
  const user = await usersRepo(db).findById(userId);
  if (!user) return null;
  const repo = curriculaRepo(db);
  const curriculum = pickCurriculum(
    await repo.listByProgram(user.studentSuffix.slice(-2)),
    user.admissionYear,
  );
  if (!curriculum) return null;
  const allCourses = await repo.listCourses(curriculum.id);
  // Attempts only matter when something is hidden, so the usual request skips the extra read.
  const courses = allCourses.some((r) => r.hidden)
    ? activeCourses(allCourses, await attemptsRepo(db, userId).listOwn())
    : allCourses;
  return { curriculum, courses, allCourses };
}

/** An attempt's course code must be in the student's curriculum (a slot code or an alternative) or one of their student courses. */
export async function isKnownCourseCode(
  db: Db,
  userId: number,
  loaded: LoadedCurriculum | null,
  code: string,
): Promise<boolean> {
  if (loaded && courseCodes(loaded.courses).has(code)) return true;
  return (await studentCoursesRepo(db, userId).listOwn()).some((s) => s.code === code);
}
