import { cgpa, gradedCredits, type CourseRecord } from "../../../shared/grading";
import type { CgpaSummary } from "../../../shared/schemas/attempts";
import type { CourseMap } from "../../../shared/schemas/courses";
import type { AttemptRow } from "../../repos/attempts";

type Known = { credits: number; nonCredit: boolean; excluded: boolean };

/** Credits and flags of every code an attempt can name: slot codes, their alternatives and student courses. */
function knownCourses(map: CourseMap): Map<string, Known> {
  const known = new Map<string, Known>();
  const add = (code: string, entry: Known) => {
    if (!known.has(code)) known.set(code, entry);
  };
  for (const category of map.categories) {
    for (const slot of category.slots) {
      if (slot.kind === "course") {
        const entry = { credits: slot.credits, nonCredit: slot.nonCredit, excluded: false };
        for (const code of [slot.code, ...slot.alternatives.map((a) => a.code)]) add(code, entry);
      }
      if (slot.studentCourse) {
        const sc = slot.studentCourse;
        add(sc.code, { credits: sc.credits, nonCredit: false, excluded: sc.excluded });
      }
    }
  }
  for (const sc of map.extras) {
    add(sc.code, { credits: sc.credits, nonCredit: false, excluded: sc.excluded });
  }
  return known;
}

/**
 * CGPA, earned credits and credits remaining by category. Earned and remaining come straight from
 * the course map so the two screens agree; CGPA takes the best grade of every course with attempts.
 */
export function buildCgpaSummary(map: CourseMap, attempts: readonly AttemptRow[]): CgpaSummary {
  const known = knownCourses(map);
  const byCode = new Map<string, { grade: string }[]>();
  for (const a of attempts) byCode.set(a.courseCode, [...(byCode.get(a.courseCode) ?? []), a]);
  const records: CourseRecord[] = [];
  for (const [code, list] of byCode) {
    const course = known.get(code);
    if (course) records.push({ ...course, attempts: list });
  }

  const remaining = (required: number, earned: number) => Math.max(0, required - earned);
  return {
    cgpa: cgpa(records),
    gradedCredits: gradedCredits(records),
    earnedCredits: map.degree.earned,
    requiredCredits: map.degree.required,
    remainingCredits: remaining(map.degree.required, map.degree.earned),
    categories: map.categories.map((c) => ({
      name: c.name,
      required: c.required,
      earned: c.earned,
      remaining: remaining(c.required, c.earned),
    })),
  };
}
