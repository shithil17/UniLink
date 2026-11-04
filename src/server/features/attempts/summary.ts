import { courseRecords } from "../../../shared/courseRecords";
import { cgpa, gradedCredits } from "../../../shared/grading";
import type { CgpaSummary } from "../../../shared/schemas/attempts";
import type { CourseMap } from "../../../shared/schemas/courses";
import type { AttemptRow } from "../../repos/attempts";

/**
 * CGPA, earned credits and credits remaining by category. Earned and remaining come straight from
 * the course map so the two screens agree; CGPA takes the best grade of every course with attempts.
 */
export function buildCgpaSummary(map: CourseMap, attempts: readonly AttemptRow[]): CgpaSummary {
  const records = courseRecords(map, attempts);

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
