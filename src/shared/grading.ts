// Letter grades and which ones earn credit. Grade points and the retake policy are added with the full attempt form.

export const LETTER_GRADES = [
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "F",
  "I",
  "W",
] as const;

export type LetterGrade = (typeof LETTER_GRADES)[number];

/** A waived course: done and earns its credits, but has no grade points, so it never touches CGPA. */
export const WAIVED = "WV";

/** Everything an attempt can record: a letter grade or a waiver. */
export const ATTEMPT_GRADES = [...LETTER_GRADES, WAIVED] as const;

export type AttemptGrade = (typeof ATTEMPT_GRADES)[number];

/** Grades that do not earn credit: failed, incomplete, withdrawn. */
const NON_PASSING: ReadonlySet<string> = new Set(["F", "I", "W"]);

/** Grades left out of CGPA: incomplete, withdrawn and waived. F counts as 0.0. */
const NOT_IN_CGPA: ReadonlySet<string> = new Set(["I", "W", WAIVED]);

/** A course is done when it has an attempt with a passing grade (any grade except F, I and W; a waiver counts). */
export function isPassingGrade(grade: string): boolean {
  return !NON_PASSING.has(grade);
}

export function countsInCgpa(grade: string): boolean {
  return !NOT_IN_CGPA.has(grade);
}

export function gradeLabel(grade: string): string {
  return grade === WAIVED ? "Waived" : grade;
}
