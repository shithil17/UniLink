import { prereqCourseCodes, type PrereqRule } from "../../../shared/prereq";

/** What the rules need to know about a slot. */
export type RuleRow = {
  id: number;
  kind: "course" | "elective";
  code: string;
  alternatives: readonly { code: string }[];
  prereq: PrereqRule | null;
};

export type CourseProblem =
  /** The new slot code is already a slot code or an alternative in this curriculum. */
  | { reason: "code_taken"; code: string }
  /** The prerequisite names codes that are not courses of this curriculum. */
  | { reason: "prereq_unknown"; codes: string[] }
  /** Another slot's prerequisite needs a code this change would remove. */
  | { reason: "code_referenced"; code: string; by: string };

const codesOf = (row: Pick<RuleRow, "code" | "alternatives">) => [
  row.code,
  ...row.alternatives.map((a) => a.code),
];

/** The codes a prerequisite can name: every course slot's code and alternatives (an elective placeholder is never passed). */
const prerequisiteCodes = (rows: readonly RuleRow[]) =>
  new Set(rows.flatMap((r) => (r.kind === "course" ? codesOf(r) : [])));

/**
 * Checks one add or edit against the rest of its curriculum. `others` are the other slots, `before`
 * is the slot as stored (null for an add) and `after` is what it becomes.
 *
 * - `checkCode`: the slot code must not be used by another slot, as its code or as an alternative.
 *   Alternatives may be shared between slots, because "choose any three" rows list the same options,
 *   so they are not compared across slots.
 * - `checkPrereq`: every course the prerequisite names must be another course slot's code or alternative.
 *   A typo would silently lock the course for every student.
 * - Always: a code this change removes must not be needed by another slot's prerequisite.
 */
export function checkCourseChange(
  others: readonly RuleRow[],
  before: RuleRow | null,
  after: RuleRow,
  opts: { checkCode: boolean; checkPrereq: boolean },
): CourseProblem | null {
  if (opts.checkCode) {
    const taken = others.flatMap(codesOf);
    if (taken.includes(after.code)) return { reason: "code_taken", code: after.code };
  }

  const knownAfter = prerequisiteCodes([...others, after]);
  if (opts.checkPrereq) {
    const own = new Set(codesOf(after));
    const unknown = [
      ...new Set(
        prereqCourseCodes(after.prereq).filter(
          (c) => own.has(c) || !prerequisiteCodes(others).has(c),
        ),
      ),
    ];
    if (unknown.length > 0) return { reason: "prereq_unknown", codes: unknown };
  }

  if (before) {
    const knownBefore = prerequisiteCodes([...others, before]);
    const removed = new Set([...knownBefore].filter((c) => !knownAfter.has(c)));
    for (const other of others) {
      const needed = prereqCourseCodes(other.prereq).find((c) => removed.has(c));
      if (needed !== undefined) return { reason: "code_referenced", code: needed, by: other.code };
    }
  }
  return null;
}
