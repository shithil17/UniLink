import { isPassingGrade } from "./grading.ts";

/**
 * A prerequisite rule tree (Composite): a course leaf, a degree-credits leaf, or an
 * `all` / `any` group of rules. A waiver such as "ENG102/Waiver" is stored as the plain course leaf.
 */
export type PrereqRule =
  | { course: string }
  | { credits: number }
  | { all: PrereqRule[] }
  | { any: PrereqRule[] };

export type PrereqState = {
  /** Course codes the student has passed (see `passedCodes`). */
  passed: ReadonlySet<string>;
  /** Degree credits earned so far; excluded student courses are not in it. */
  earnedCredits: number;
};

/** No rule, or an empty `all` / `any` group, is met. */
export function isPrereqMet(rule: PrereqRule | null | undefined, state: PrereqState): boolean {
  if (!rule) return true;
  if ("course" in rule) return state.passed.has(rule.course);
  if ("credits" in rule) return state.earnedCredits >= rule.credits;
  if ("all" in rule) return rule.all.every((r) => isPrereqMet(r, state));
  if (rule.any.length === 0) return true;
  return rule.any.some((r) => isPrereqMet(r, state));
}

/** Every course code the rule mentions, in order of appearance. */
export function prereqCourseCodes(rule: PrereqRule | null | undefined): string[] {
  if (!rule) return [];
  if ("course" in rule) return [rule.course];
  if ("credits" in rule) return [];
  return (("all" in rule ? rule.all : rule.any) as PrereqRule[]).flatMap(prereqCourseCodes);
}

/** The codes with at least one passing attempt. An F, I or W never counts. */
export function passedCodes(
  attempts: Iterable<{ courseCode: string; grade: string }>,
): Set<string> {
  const passed = new Set<string>();
  for (const a of attempts) if (isPassingGrade(a.grade)) passed.add(a.courseCode);
  return passed;
}
