import type { CourseStatus } from "../../shared/schemas/courses";

/** A course a picker offers. `status` is its state on the student's map, when it has one. */
export type CourseChoice = {
  code: string;
  title: string;
  status?: CourseStatus;
  waived?: boolean;
};

// Courses the student can take now come first, then locked ones, then ones already done.
const STATUS_ORDER: Record<CourseStatus, number> = { available: 0, locked: 1, done: 2 };
const statusRank = (c: CourseChoice) => (c.status ? STATUS_ORDER[c.status] : 0);

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const compact = (s: string) => fold(s).replace(/[^a-z0-9]/g, "");
const words = (s: string) =>
  fold(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/**
 * How well a course matches: 0 for the exact code, 1 for a code that starts with the query
 * ("cse 1", "cse11"), 2 for a code that contains it ("115"), 3 when every query word starts a word
 * of the title ("prog lang"). Null for no match.
 */
function matchScore(course: CourseChoice, query: string): number | null {
  const code = compact(course.code);
  const q = compact(query);
  if (q !== "") {
    if (code === q) return 0;
    if (code.startsWith(q)) return 1;
    if (code.includes(q)) return 2;
  }
  const wanted = words(query);
  const titleWords = words(course.title);
  if (wanted.length > 0 && wanted.every((w) => titleWords.some((t) => t.startsWith(w)))) return 3;
  return null;
}

/**
 * The courses matching `query`, best match first, then the ones the student can take now, then by
 * code. An empty query lists every course in that same order.
 */
export function searchCourses<T extends CourseChoice>(choices: readonly T[], query: string): T[] {
  const scored = choices.flatMap((course) => {
    const score = query.trim() === "" ? 0 : matchScore(course, query);
    return score === null ? [] : [{ course, score }];
  });
  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        statusRank(a.course) - statusRank(b.course) ||
        a.course.code.localeCompare(b.course.code),
    )
    .map((s) => s.course);
}
