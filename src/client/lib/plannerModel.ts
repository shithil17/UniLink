import { courseRecords } from "../../shared/courseRecords";
import { bestAttempt, canRetake, gradePoints } from "../../shared/grading";
import {
  PLANNER_HISTORY_MIN_COURSES,
  type Advice,
  type PlannerCourse,
  type PlannerMock,
  type RemainingCourse,
} from "../../shared/planner";
import type { CourseMap, CourseStatus } from "../../shared/schemas/courses";
import { slotLabel } from "../../shared/slotChoice";

/** A course row the planner offers a mock grade for. */
export type PlannerRow = {
  /** Keys the mock. A course with attempts uses its code; an unattempted slot uses its own unique key. */
  key: string;
  code: string;
  title: string;
  credits: number;
  category: string;
  /** "future": a first attempt, or the pass of an F-only course. "retake": a graded course that may be retaken. */
  kind: "future" | "retake";
  /** The best grade so far, for a row that already has a graded attempt. */
  best: string | null;
  status: CourseStatus;
  waived: boolean;
};

export type PlannerModel = {
  /** Every course with attempts, as the CGPA sees them. */
  records: PlannerCourse[];
  /** The unfinished credit-bearing slots: what is left of the degree. */
  remaining: RemainingCourse[];
  future: PlannerRow[];
  retakes: PlannerRow[];
  /** Graded courses that can no longer be retaken, so they have no row. */
  lockedCount: number;
};

type Category = CourseMap["categories"][number];
type Slot = Category["slots"][number];

/**
 * The planner's inputs from the course map and the attempts the courses screen already loads.
 *
 * - Past courses: a passing, graded course (a slot or an extra course) offers a retake mock only
 *   while `canRetake()` allows one.
 * - Future courses: every unfinished, credit-bearing slot, including elective slots with no course
 *   picked yet (the slot's own credits, a unique key instead of a code). A slot whose course has
 *   only an F is one of these: its code matches the F record, so a mock there passes the F.
 */
export function buildPlannerModel(
  map: CourseMap,
  attempts: readonly { courseCode: string; grade: string }[],
): PlannerModel {
  const records = withCategories(courseRecords(map, attempts), map);
  const recordOf = new Map(records.map((r) => [r.code, r]));
  const future: PlannerRow[] = [];
  const retakes: PlannerRow[] = [];
  let lockedCount = 0;

  const addPast = (row: Omit<PlannerRow, "kind" | "best">) => {
    const record = recordOf.get(row.key);
    const best = record ? bestAttempt(record.attempts) : null;
    if (!record || !best || record.nonCredit || record.excluded) return;
    if (!canRetake(record.attempts)) {
      lockedCount++;
      return;
    }
    retakes.push({ ...row, kind: "retake", best: best.grade });
  };

  const addFuture = (row: Omit<PlannerRow, "kind" | "best">) => {
    const record = recordOf.get(row.key);
    const best = record ? bestAttempt(record.attempts) : null;
    future.push({ ...row, kind: "future", best: best?.grade ?? null });
  };

  for (const category of map.categories) {
    category.slots.forEach((slot: Slot, index) => {
      if (slot.nonCredit) return;
      const filler = slot.studentCourse;
      const done = slot.status === "done";
      const unique = `slot:${category.name}:${index}`;
      const base = { category: category.name, status: slot.status, waived: slot.waived };

      if (slot.kind === "elective") {
        if (filler) {
          const row = { ...base, key: filler.code, code: filler.code, title: filler.title };
          if (done) {
            if (!filler.waived) addPast({ ...row, credits: filler.credits });
          } else {
            addFuture({ ...row, credits: filler.credits });
          }
        } else {
          addFuture({
            ...base,
            key: unique,
            code: slot.code,
            title: slot.title || slot.code,
            credits: slot.credits,
          });
        }
        return;
      }

      const label = slotLabel(slot);
      if (done) {
        const code = slot.filledBy ?? label.code;
        const title = [{ code: slot.code, title: slot.title }, ...slot.alternatives].find(
          (c) => c.code === code,
        )?.title;
        if (!slot.waived) {
          addPast({ ...base, key: code, code, title: title ?? slot.title, credits: slot.credits });
        }
        return;
      }
      // Not done: a course with attempts (an F, an incomplete) keeps its code so a mock replaces them.
      const key = slot.chosenCode ?? unique;
      addFuture({
        ...base,
        key,
        code: label.code,
        title: label.title,
        credits: slot.credits,
      });
    });
  }

  // Student courses beyond the elective placeholders are real graded courses too: retake candidates.
  for (const course of map.extras) {
    if (course.excluded || !course.done || course.waived) continue;
    addPast({
      key: course.code,
      code: course.code,
      title: course.title,
      credits: course.credits,
      category: course.category,
      status: "done",
      waived: false,
    });
  }

  // Worst grade first: those gain the most from a retake, and a long list opens on its first rows.
  retakes.sort((a, b) => (gradePoints(a.best ?? "") ?? 0) - (gradePoints(b.best ?? "") ?? 0));

  return {
    records,
    remaining: future.map((r) => ({ code: r.key, credits: r.credits, category: r.category })),
    future,
    retakes,
    lockedCount,
  };
}

/** Files each record under its course map category, which the advisor predicts grades by. */
function withCategories(records: PlannerCourse[], map: CourseMap): PlannerCourse[] {
  const categoryOf = new Map<string, string>();
  const add = (code: string, category: string) => {
    if (!categoryOf.has(code)) categoryOf.set(code, category);
  };
  for (const category of map.categories) {
    for (const slot of category.slots) {
      add(slot.code, category.name);
      for (const alternative of slot.alternatives) add(alternative.code, category.name);
      if (slot.studentCourse) add(slot.studentCourse.code, category.name);
    }
  }
  for (const course of map.extras) add(course.code, course.category);
  return records.map((r) => ({ ...r, category: categoryOf.get(r.code) }));
}

/** The mocks for the rows that have a picked grade; picks for rows that no longer exist are dropped. */
export function mocksForRows(
  rows: readonly PlannerRow[],
  picks: Readonly<Record<string, string>>,
): PlannerMock[] {
  const mocks: PlannerMock[] = [];
  for (const row of rows) {
    const grade = picks[row.key];
    if (grade) mocks.push({ code: row.key, credits: row.credits, grade });
  }
  return mocks;
}

/** Whether a mock grade changes nothing on a row: its best grade already matches or beats it. */
export function mockChangesNothing(row: PlannerRow, grade: string): boolean {
  if (row.best === null) return false;
  return (gradePoints(grade) ?? 0) <= (gradePoints(row.best) ?? 0);
}

/** Float noise below this is not a difference between two CGPAs. */
const REACHED_EPSILON = 1e-9;

/** True once the real CGPA is at or above the saved target. */
export function targetReached(current: number | null, target: number | null): boolean {
  return current !== null && target !== null && current >= target - REACHED_EPSILON;
}

/** Shown with every outcome: the advice is arithmetic on grades, never a promise. */
export const ESTIMATE_NOTE = "Estimates only. Retake rules and fees are set by NSU.";

/** What the predictions rest on, in a line. */
export function historyLine({ outlook, ceiling }: Pick<Advice, "outlook" | "ceiling">): string {
  if (outlook.source === "history" && outlook.average !== null) {
    return `Predicted from your grades by category (average ${outlook.average.toFixed(2)}), assuming ${ceiling.grade} at best.`;
  }
  const so = outlook.gradedCourses === 0 ? "none" : `${outlook.gradedCourses}`;
  return `Rough until you have ${PLANNER_HISTORY_MIN_COURSES} graded courses (${so} so far).`;
}
