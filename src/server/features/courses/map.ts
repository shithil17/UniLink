import { WAIVED } from "../../../shared/grading";
import { isPrereqMet, passedCodes } from "../../../shared/prereq";
import type { CourseMap } from "../../../shared/schemas/courses";
import { pickChosenCode } from "../../../shared/slotChoice";
import { NSU_PROGRAM_CODES } from "../../../shared/studentId";
import type { AttemptRow } from "../../repos/attempts";
import type { CourseRow, CurriculumRow, ElectiveOptionRow } from "../../repos/curricula";
import type { StudentCourseRow } from "../../repos/studentCourses";

type MapStudentCourse = CourseMap["extras"][number];
type MapSlot = CourseMap["categories"][number]["slots"][number];
type MapTrails = NonNullable<CourseMap["categories"][number]["trails"]>;

/**
 * Trail progress for the category the curriculum's trails fill. Only the student's own non-excluded
 * courses in that category count, each toward the trail that lists its code. Done is a passing
 * attempt; added is anything else. A trail course filed under another category counts nowhere.
 */
function buildTrails(
  rule: { category: string; minFromOneTrail: number },
  options: readonly ElectiveOptionRow[],
  studentCourses: readonly { code: string; category: string; excluded: boolean }[],
  passed: ReadonlySet<string>,
): MapTrails {
  const own = new Set(
    studentCourses.filter((s) => !s.excluded && s.category === rule.category).map((s) => s.code),
  );
  const byTrail = new Map<string, MapTrails["trails"][number]>();
  for (const o of options) {
    let trail = byTrail.get(o.trail);
    if (!trail) byTrail.set(o.trail, (trail = { name: o.trail, done: 0, added: 0, courses: [] }));
    const state = !own.has(o.code) ? null : passed.has(o.code) ? "done" : "added";
    if (state === "done") trail.done += 1;
    if (state === "added") trail.added += 1;
    trail.courses.push({ code: o.code, title: o.title, credits: o.credits, state });
  }
  const trails = [...byTrail.values()];
  // Most done, then most added; Array.sort is stable, so file order breaks the rest.
  const leader = [...trails].sort((a, b) => b.done - a.done || b.added - a.added)[0];
  return {
    minFromOneTrail: rule.minFromOneTrail,
    met: trails.some((t) => t.done >= rule.minFromOneTrail),
    leading: leader && leader.done + leader.added > 0 ? leader.name : null,
    trails,
  };
}

export const EMPTY_COURSE_MAP: CourseMap = {
  curriculum: null,
  degree: { required: 0, earned: 0 },
  categories: [],
  extras: [],
};

/**
 * The curriculum with the highest `effectiveFromYear` not after the admission year (both YY), else
 * the oldest one. ceiling: two-digit years, so a map effective from 99 and a student admitted in 00
 * would mix up. Revisit before 2100.
 */
export function pickCurriculum<T extends { effectiveFromYear: number }>(
  versions: readonly T[],
  admissionYear: number,
): T | null {
  const sorted = [...versions].sort((a, b) => a.effectiveFromYear - b.effectiveFromYear);
  const fitting = sorted.filter((v) => v.effectiveFromYear <= admissionYear);
  return fitting.at(-1) ?? sorted[0] ?? null;
}

/**
 * The slots a student sees. A hidden slot (see the mod Courses screen) is left out unless the
 * student already has an attempt on one of its codes: their grades must keep counting and the map
 * must not lose a course they took. Nothing is deleted either way.
 */
export function activeCourses(
  rows: readonly CourseRow[],
  attempts: readonly { courseCode: string }[],
): CourseRow[] {
  if (!rows.some((r) => r.hidden)) return [...rows];
  const attempted = new Set(attempts.map((a) => a.courseCode));
  return rows.filter(
    (r) =>
      !r.hidden || [r.code, ...r.alternatives.map((a) => a.code)].some((c) => attempted.has(c)),
  );
}

/** Every code a student can record an attempt for: course slot codes and their alternatives. */
export function courseCodes(rows: readonly CourseRow[]): Set<string> {
  return new Set(
    rows.flatMap((r) =>
      r.kind === "course" ? [r.code, ...r.alternatives.map((a) => a.code)] : [],
    ),
  );
}

/** Every code the curriculum uses, elective placeholders included: a student course must not reuse one. */
export function allCurriculumCodes(rows: readonly CourseRow[]): Set<string> {
  return new Set(rows.flatMap((r) => [r.code, ...r.alternatives.map((a) => a.code)]));
}

export function buildCourseMap(input: {
  curriculum: CurriculumRow;
  courses: readonly CourseRow[];
  attempts: readonly AttemptRow[];
  /** In the order they were added. */
  studentCourses: readonly StudentCourseRow[];
  /** The curriculum's trail courses; needed only when it has an elective rule. */
  electiveOptions?: readonly ElectiveOptionRow[];
}): CourseMap {
  const { curriculum, courses } = input;
  const passed = passedCodes(input.attempts);
  // A code is waived when a waiver is its only passing attempt; a real pass wins over it.
  const gradedPasses = passedCodes(input.attempts.filter((a) => a.grade !== WAIVED));
  const isWaived = (code: string | undefined) =>
    code !== undefined && passed.has(code) && !gradedPasses.has(code);
  const toMapCourse = (sc: StudentCourseRow): MapStudentCourse => ({
    id: sc.id,
    code: sc.code,
    title: sc.title,
    credits: sc.credits,
    category: sc.category,
    excluded: sc.excluded,
    createdAt: sc.createdAt,
    done: passed.has(sc.code),
    waived: isWaived(sc.code),
  });

  // Course slots, in curriculum order: a passing attempt fills the first slot that accepts it and
  // fills at most one, so "choose any three" rows sharing alternatives need three different courses.
  const usedCodes = new Set<string>();
  const filledBy = new Map<number, string>();
  for (const row of courses) {
    if (row.kind !== "course") continue;
    const code = [row.code, ...row.alternatives.map((a) => a.code)].find(
      (c) => passed.has(c) && !usedCodes.has(c),
    );
    if (code !== undefined) {
      usedCodes.add(code);
      filledBy.set(row.id, code);
    }
  }

  // Student courses fill their category's elective placeholders in the order they were added.
  // Excluded ones fill nothing: they are only listed.
  const fillers = new Map<number, MapStudentCourse>();
  const extras: MapStudentCourse[] = [];
  const queues = new Map<string, MapStudentCourse[]>();
  for (const sc of input.studentCourses) {
    if (sc.excluded) extras.push(toMapCourse(sc));
    else queues.set(sc.category, [...(queues.get(sc.category) ?? []), toMapCourse(sc)]);
  }
  for (const row of courses) {
    const next = row.kind === "elective" ? queues.get(row.category)?.shift() : undefined;
    if (next) fillers.set(row.id, next);
  }
  for (const rest of queues.values()) extras.push(...rest);
  extras.sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);

  // Credits. Earned has no cap, and excluded courses and non-credit courses add nothing.
  const categories = new Map<string, { required: number; earned: number; rows: CourseRow[] }>();
  const category = (name: string) => {
    let c = categories.get(name);
    if (!c) categories.set(name, (c = { required: 0, earned: 0, rows: [] }));
    return c;
  };
  for (const row of courses) {
    const c = category(row.category);
    c.rows.push(row);
    if (row.nonCredit) continue;
    c.required += row.credits;
    if (row.kind === "course" && filledBy.has(row.id)) c.earned += row.credits;
    const filler = fillers.get(row.id);
    if (filler?.done) c.earned += filler.credits;
  }
  for (const sc of extras) if (sc.done && !sc.excluded) category(sc.category).earned += sc.credits;
  let earned = 0;
  for (const c of categories.values()) earned += c.earned;

  // A filled slot counts as its own code being passed, so a prerequisite on POL101 is met by POL104.
  const state = {
    passed: new Set([...passed, ...courses.filter((r) => filledBy.has(r.id)).map((r) => r.code)]),
    earnedCredits: earned,
  };

  // The course a slot shows once the student has taken one: the passing attempt that filled it, else
  // the best of the failed ones. A code another slot already used does not count for this one.
  const chosenCodeOf = (row: CourseRow): string | null => {
    if (row.kind !== "course") return null;
    return (
      filledBy.get(row.id) ??
      pickChosenCode(
        [row.code, ...row.alternatives.map((a) => a.code)].filter((c) => !usedCodes.has(c)),
        input.attempts,
      )
    );
  };

  const toSlot = (row: CourseRow): MapSlot => {
    const studentCourse = fillers.get(row.id) ?? null;
    const done = row.kind === "course" ? filledBy.has(row.id) : (studentCourse?.done ?? false);
    return {
      kind: row.kind,
      code: row.code,
      title: row.title,
      credits: row.credits,
      category: row.category,
      nonCredit: row.nonCredit,
      semester: row.semester,
      alternatives: row.alternatives,
      prereq: row.prereq,
      status: done ? "done" : isPrereqMet(row.prereq, state) ? "available" : "locked",
      filledBy: filledBy.get(row.id) ?? null,
      chosenCode: chosenCodeOf(row),
      waived: isWaived(filledBy.get(row.id)),
      studentCourse,
    };
  };

  const rule = curriculum.electiveRule;
  return {
    curriculum: {
      id: curriculum.id,
      programCode: curriculum.programCode,
      programName: NSU_PROGRAM_CODES[curriculum.programCode] ?? curriculum.name,
      name: curriculum.name,
      version: curriculum.version,
      effectiveFromYear: curriculum.effectiveFromYear,
    },
    degree: { required: curriculum.totalCredits, earned },
    categories: [...categories].map(([name, c]) => ({
      name,
      required: c.required,
      earned: c.earned,
      slots: c.rows.map(toSlot),
      trails:
        rule && rule.category === name
          ? buildTrails(rule, input.electiveOptions ?? [], input.studentCourses, passed)
          : null,
    })),
    extras,
  };
}
