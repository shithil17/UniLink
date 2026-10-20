import type { Db } from "../../db/client";
import {
  curriculaRepo,
  type CourseRow,
  type CurriculumRow,
  type ElectiveOptionRow,
} from "../../repos/curricula";
import { studentCoursesRepo } from "../../repos/studentCourses";
import { usersRepo } from "../../repos/users";
import { attemptsRepo } from "../../repos/attempts";
import { activeCourses, courseCodes, pickCurriculum } from "./map";

export type LoadedCurriculum = {
  curriculum: CurriculumRow;
  /** The slots this student sees: hidden ones are left out unless they have an attempt on them. */
  courses: CourseRow[];
  /** The curriculum's trail courses; empty unless it has an elective rule. */
  electiveOptions: ElectiveOptionRow[];
  /** Every slot, hidden ones included: codes there stay taken. */
  allCourses: CourseRow[];
};

/** The student's curriculum row: their program (last two digits of the student ID suffix) and admission year. */
export async function findCurriculum(db: Db, userId: number): Promise<CurriculumRow | null> {
  const user = await usersRepo(db).findById(userId);
  if (!user) return null;
  return pickCurriculum(
    await curriculaRepo(db).listByProgram(user.studentSuffix.slice(-2)),
    user.admissionYear,
  );
}

/** The student's curriculum with its slots. */
export async function loadCurriculum(db: Db, userId: number): Promise<LoadedCurriculum | null> {
  const curriculum = await findCurriculum(db, userId);
  if (!curriculum) return null;
  const repo = curriculaRepo(db);
  const allCourses = await repo.listCourses(curriculum.id);
  // Attempts only matter when something is hidden, so the usual request skips the extra read.
  const courses = allCourses.some((r) => r.hidden)
    ? activeCourses(allCourses, await attemptsRepo(db, userId).listOwn())
    : allCourses;
  // Trail options only matter on a curriculum with a rule, so the usual request skips the read.
  const electiveOptions = curriculum.electiveRule
    ? await repo.listElectiveOptions(curriculum.id)
    : [];
  return { curriculum, courses, electiveOptions, allCourses };
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
