import type { Db } from "../../db/client";
import { curriculaRepo, type CourseRow, type CurriculumRow } from "../../repos/curricula";
import { studentCoursesRepo } from "../../repos/studentCourses";
import { usersRepo } from "../../repos/users";
import { courseCodes, pickCurriculum } from "./map";

export type LoadedCurriculum = { curriculum: CurriculumRow; courses: CourseRow[] };

/** The student's curriculum: their program (last two digits of the student ID suffix) and admission year. */
export async function loadCurriculum(db: Db, userId: number): Promise<LoadedCurriculum | null> {
  const user = await usersRepo(db).findById(userId);
  if (!user) return null;
  const repo = curriculaRepo(db);
  const curriculum = pickCurriculum(
    await repo.listByProgram(user.studentSuffix.slice(-2)),
    user.admissionYear,
  );
  return curriculum ? { curriculum, courses: await repo.listCourses(curriculum.id) } : null;
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
