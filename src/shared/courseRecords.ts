// The course records behind CGPA: every course the student has an attempt for, with its credits and
// flags from the course map. The server's CGPA summary and the planner both build them here, so the
// two cannot disagree about which courses count.

import type { CourseRecord } from "./grading";
import type { CourseMap } from "./schemas/courses";

type Known = { credits: number; nonCredit: boolean; excluded: boolean };

/** A course the student has taken, keyed by its code. */
export type CodedRecord = CourseRecord & { code: string };

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

/** One record per course code with attempts, in the order the attempts first name them. Unknown codes are left out. */
export function courseRecords(
  map: CourseMap,
  attempts: readonly { courseCode: string; grade: string }[],
): CodedRecord[] {
  const known = knownCourses(map);
  const byCode = new Map<string, { grade: string }[]>();
  for (const a of attempts) byCode.set(a.courseCode, [...(byCode.get(a.courseCode) ?? []), a]);
  const records: CodedRecord[] = [];
  for (const [code, list] of byCode) {
    const course = known.get(code);
    if (course) records.push({ ...course, code, attempts: list });
  }
  return records;
}
