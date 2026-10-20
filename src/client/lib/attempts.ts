import { canRetake, retakeRefusal } from "../../shared/grading";
import type { Attempt, CgpaSummary } from "../../shared/schemas/attempts";
import { termLabel } from "./courseMap";

/** "3.42", or an en dash while no graded course counts yet. The server sends the value unrounded. */
export function formatCgpa(cgpa: number | null): string {
  return cgpa === null ? "–" : cgpa.toFixed(2);
}

/** The attempts for the given course codes, oldest first (the order the server sends). */
export function attemptsForCodes(attempts: readonly Attempt[], codes: readonly string[]) {
  return attempts.filter((a) => codes.includes(a.courseCode));
}

/** The codes with at least one attempt that can still be retaken: the map row's "Retake" badge. */
export function retakeCodes(attempts: readonly Attempt[]): Set<string> {
  const byCode = new Map<string, Attempt[]>();
  for (const a of attempts) byCode.set(a.courseCode, [...(byCode.get(a.courseCode) ?? []), a]);
  const open = new Set<string>();
  for (const [code, list] of byCode) if (canRetake(list)) open.add(code);
  return open;
}

/** Whether one more attempt at `code` is allowed, and the sentence that says why not. */
export function retakeStatus(attempts: readonly Attempt[], code: string) {
  const reason = retakeRefusal(
    code,
    attempts.filter((a) => a.courseCode === code),
  );
  return reason === null ? { allowed: true as const, reason } : { allowed: false as const, reason };
}

/** "Fall 2025", or "Term not set" for an attempt recorded without one. */
export function attemptTermLabel(term: Attempt["term"]): string {
  return term ? termLabel(term) : "Term not set";
}

/** The categories that still need credits; the ones already met are left out. */
export function categoriesLeft(summary: Pick<CgpaSummary, "categories">) {
  return summary.categories.filter((c) => c.remaining > 0);
}
