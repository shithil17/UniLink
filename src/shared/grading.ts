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

/** Grades that do not earn credit: failed, incomplete, withdrawn. */
const NON_PASSING: ReadonlySet<string> = new Set(["F", "I", "W"]);

/** A course is done when it has an attempt with a passing grade (any grade except F, I and W). */
export function isPassingGrade(grade: string): boolean {
  return !NON_PASSING.has(grade);
}
