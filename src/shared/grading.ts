// Letter grades, the grade scale, which grades earn credit, and the retake policy. The scale and the
// policy are Strategy objects: a different scale or policy is a new object, not an `if`.

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

// --- Grade scale (Strategy) ---

/** Maps a letter grade to grade points. A grade missing from `points` has none (I, W, WV). */
export type GradeScale = {
  readonly name: string;
  readonly points: Readonly<Record<string, number>>;
};

export const NSU_SCALE: GradeScale = {
  name: "nsu",
  points: {
    A: 4.0,
    "A-": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B-": 2.7,
    "C+": 2.3,
    C: 2.0,
    "C-": 1.7,
    "D+": 1.3,
    D: 1.0,
    F: 0.0,
  },
};

/** Grade points, or null for a grade that has none (I, W, WV). */
export function gradePoints(grade: string, scale: GradeScale = NSU_SCALE): number | null {
  return scale.points[grade] ?? null;
}

/** Grades that can be the "best" one: they have points and count in CGPA. */
const isGraded = (grade: string, scale: GradeScale) =>
  countsInCgpa(grade) && gradePoints(grade, scale) !== null;

/** The best graded attempt (highest points; the earliest wins a tie), or null when none is graded. I, W and WV are ignored. */
export function bestAttempt<T extends { grade: string }>(
  attempts: readonly T[],
  scale: GradeScale = NSU_SCALE,
): T | null {
  let best: T | null = null;
  for (const a of attempts) {
    if (!isGraded(a.grade, scale)) continue;
    if (
      best === null ||
      (gradePoints(a.grade, scale) ?? 0) > (gradePoints(best.grade, scale) ?? 0)
    ) {
      best = a;
    }
  }
  return best;
}

// --- CGPA and credits ---

/** One course a student took: its credits and every attempt at it. */
export type CourseRecord = {
  credits: number;
  /** Non-credit courses add nothing to CGPA or earned credits. */
  nonCredit?: boolean;
  /** Excluded from the transcript: counts toward nothing. */
  excluded?: boolean;
  attempts: readonly { grade: string }[];
};

/** Credits and credit-weighted points of the courses behind CGPA: each one's best grade, F as 0.0, no I, W, WV, non-credit or excluded course. */
function gradedTotals(courses: readonly CourseRecord[], scale: GradeScale) {
  let weighted = 0;
  let credits = 0;
  for (const course of courses) {
    if (course.nonCredit || course.excluded) continue;
    const best = bestAttempt(course.attempts, scale);
    if (!best) continue;
    weighted += (gradePoints(best.grade, scale) ?? 0) * course.credits;
    credits += course.credits;
  }
  return { weighted, credits };
}

/** Credit-weighted mean of each course's best grade, or null when no course has a graded attempt. */
export function cgpa(
  courses: readonly CourseRecord[],
  scale: GradeScale = NSU_SCALE,
): number | null {
  const { weighted, credits } = gradedTotals(courses, scale);
  return credits === 0 ? null : weighted / credits;
}

/** Credits of the courses behind `cgpa()`: the denominator. */
export function gradedCredits(
  courses: readonly CourseRecord[],
  scale: GradeScale = NSU_SCALE,
): number {
  return gradedTotals(courses, scale).credits;
}

/** Credits of the courses with a passing attempt (a waiver counts), each once however often it was taken. */
export function earnedCredits(courses: readonly CourseRecord[]): number {
  let total = 0;
  for (const course of courses) {
    if (course.nonCredit || course.excluded) continue;
    if (course.attempts.some((a) => isPassingGrade(a.grade))) total += course.credits;
  }
  return total;
}

// --- Retake policy (Strategy) ---

export type RetakePolicy = {
  readonly name: string;
  /** A new attempt is allowed only while the best grade so far is below this one. */
  readonly blockedFrom: string;
};

export const BELOW_B_PLUS_POLICY: RetakePolicy = { name: "below-b-plus", blockedFrom: "B+" };

/**
 * Whether one more attempt at a course is allowed, given its other attempts. Blocked once the best
 * graded attempt reaches the policy's cutoff. I, W and WV never block, and attempts are unlimited
 * while it holds.
 */
export function canRetake(
  attempts: readonly { grade: string }[],
  policy: RetakePolicy = BELOW_B_PLUS_POLICY,
  scale: GradeScale = NSU_SCALE,
): boolean {
  const best = bestAttempt(attempts, scale);
  if (!best) return true;
  const cutoff = gradePoints(policy.blockedFrom, scale) ?? Number.POSITIVE_INFINITY;
  return (gradePoints(best.grade, scale) ?? 0) < cutoff;
}
