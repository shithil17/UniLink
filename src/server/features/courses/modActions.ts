import { auditActions } from "../../../shared/auditActions";
import type { CourseInput, CoursePatch } from "../../../shared/schemas/modCourses";
import { mergedSlotShape } from "../../../shared/schemas/modCourses";
import { audit } from "../../audit";
import type { Db } from "../../db/client";
import { curriculaRepo, type CourseRow, type CourseState } from "../../repos/curricula";
import type { Actor } from "../mod/actions";
import { checkCourseChange, type CourseProblem, type RuleRow } from "./courseRules";

// Each action changes state, then writes its audit row with the before-snapshot a reversal needs.
// The snapshot holds only the columns the action changed.

export type CourseFailure =
  | "not_found"
  | "already_hidden"
  | "not_hidden"
  | "invalid"
  | CourseProblem["reason"];

export type CourseResult =
  | { ok: true; row: CourseRow }
  | { ok: false; reason: CourseFailure; message?: string; codes?: string[] };

const STATE_KEYS = [
  "kind",
  "code",
  "title",
  "credits",
  "category",
  "nonCredit",
  "semester",
  "alternatives",
  "prereq",
  "hidden",
] as const satisfies readonly (keyof CourseState)[];

const toRuleRow = (r: CourseRow): RuleRow => ({
  id: r.id,
  kind: r.kind,
  code: r.code,
  alternatives: r.alternatives,
  prereq: r.prereq,
});

/** The plain-words refusal for a problem `checkCourseChange` found. */
export function problemResult(problem: CourseProblem): CourseResult {
  switch (problem.reason) {
    case "code_taken":
      return {
        ok: false,
        reason: "code_taken",
        message: `${problem.code} is already used by another course in this curriculum, as its code or as an alternative.`,
      };
    case "prereq_unknown":
      return {
        ok: false,
        reason: "prereq_unknown",
        codes: problem.codes,
        message: `${problem.codes.join(", ")} ${problem.codes.length === 1 ? "isn't" : "aren't"} another course in this curriculum. Check the spelling, or add that course first.`,
      };
    case "code_referenced":
      return {
        ok: false,
        reason: "code_referenced",
        message: `${problem.by} lists ${problem.code} as a prerequisite. Change that course's prerequisite first.`,
      };
  }
}

export async function addCourse(
  db: Db,
  actor: Actor,
  curriculumId: number,
  input: CourseInput,
  now: number = Date.now(),
): Promise<CourseResult> {
  const repo = curriculaRepo(db);
  if (!(await repo.findById(curriculumId))) return { ok: false, reason: "not_found" };
  const others = (await repo.listCourses(curriculumId)).map(toRuleRow);
  const problem = checkCourseChange(
    others,
    null,
    { id: 0, ...input },
    { checkCode: true, checkPrereq: true },
  );
  if (problem) return problemResult(problem);

  const written = await repo.addCourse(curriculumId, input);
  if (!written.ok) return problemResult({ reason: "code_taken", code: input.code });
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.courseAdd,
      targetType: "course",
      targetId: written.row.id,
    },
    now,
  );
  return { ok: true, row: written.row };
}

export async function editCourse(
  db: Db,
  actor: Actor,
  id: number,
  patch: CoursePatch,
  now: number = Date.now(),
): Promise<CourseResult> {
  const repo = curriculaRepo(db);
  const current = await repo.findCourse(id);
  if (!current) return { ok: false, reason: "not_found" };

  const merged = { ...current, ...patch };
  const shape = mergedSlotShape.safeParse(merged);
  if (!shape.success) {
    return { ok: false, reason: "invalid", message: shape.error.issues[0]?.message };
  }
  const others = (await repo.listCourses(current.curriculumId))
    .filter((r) => r.id !== id)
    .map(toRuleRow);
  const problem = checkCourseChange(others, toRuleRow(current), toRuleRow(merged), {
    checkCode: patch.code !== undefined && patch.code !== current.code,
    checkPrereq: patch.prereq !== undefined,
  });
  if (problem) return problemResult(problem);

  const written = await repo.updateCourse(id, patch);
  if (!written) return { ok: false, reason: "not_found" };
  if (!written.ok) return problemResult({ reason: "code_taken", code: merged.code });
  const before: Partial<CourseState> = {};
  for (const key of STATE_KEYS) {
    if (key in patch) Object.assign(before, { [key]: current[key] });
  }
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.courseEdit,
      targetType: "course",
      targetId: id,
      before,
    },
    now,
  );
  return { ok: true, row: written.row };
}

/** Hides or shows a slot again. Nothing is deleted: students' attempts keep their codes. */
export async function setCourseHidden(
  db: Db,
  actor: Actor,
  id: number,
  hidden: boolean,
  reason: string,
  now: number = Date.now(),
): Promise<CourseResult> {
  const repo = curriculaRepo(db);
  const row = await repo.setCourseHidden(id, hidden);
  if (!row) {
    if (!(await repo.findCourse(id))) return { ok: false, reason: "not_found" };
    return { ok: false, reason: hidden ? "already_hidden" : "not_hidden" };
  }
  await audit(
    db,
    {
      actor: actor.id,
      action: hidden ? auditActions.courseHide : auditActions.courseUnhide,
      targetType: "course",
      targetId: id,
      before: { hidden: !hidden },
      reason,
    },
    now,
  );
  return { ok: true, row };
}
