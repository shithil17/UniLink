import { z } from "zod";
import type { PrereqRule } from "../prereq.ts";
import { parsePrereq } from "../prereqText.ts";
import { id } from "./common.ts";
import {
  COURSE_CODE_PATTERN,
  courseCredits,
  courseKind,
  prereqRule,
  SEMESTER_MAX,
  slotShapeIssues,
} from "./courses.ts";
import { reasonBody } from "./moderation.ts";

// The mod Courses screen: pick a curriculum, then add, edit, hide and show its slots.

// ceiling: NSU category names run to a few words ("Core Courses in the Major"); this only stops a pasted wall of text. Revisit if a real category is refused.
export const CATEGORY_MAX_LENGTH = 100;
// ceiling: the longest course title is a line; matches the curriculum import. Revisit if a real title is refused.
export const COURSE_TITLE_MAX_LENGTH = 200;
// ceiling: the longest prerequisite rule in the curriculum files is a short sentence. Revisit if a real rule is refused.
export const PREREQ_TEXT_MAX_LENGTH = 300;

/** A code typed into a form: trimmed and capitalised. The kind decides the pattern (see `slotShapeIssues`). */
const typedCode = z.string().trim().toUpperCase().min(1, "Enter the code");

const typedAlternative = z.object({
  code: typedCode.regex(COURSE_CODE_PATTERN, "Course codes look like CSE115 or CSE115L"),
  title: z
    .string()
    .trim()
    .min(1, "Enter the title")
    .max(COURSE_TITLE_MAX_LENGTH, `Use at most ${COURSE_TITLE_MAX_LENGTH} characters`),
});

/**
 * Prerequisites as a mod types them: `CSE215 and (MAT120 or MAT125)`, or empty for none. The text is
 * turned into a rule here, so a mistake is a field error with the parser's message, on the client and
 * the server alike.
 */
const prereqText = z
  .string()
  .max(PREREQ_TEXT_MAX_LENGTH, `Use at most ${PREREQ_TEXT_MAX_LENGTH} characters`)
  .transform((value, ctx): PrereqRule | null => {
    const parsed = parsePrereq(value);
    if (parsed.ok) return parsed.rule;
    ctx.issues.push({ code: "custom", message: parsed.message, input: value });
    return z.NEVER;
  });

const courseFields = z.object({
  kind: courseKind,
  code: typedCode,
  title: z
    .string()
    .trim()
    .min(1, "Enter the title")
    .max(COURSE_TITLE_MAX_LENGTH, `Use at most ${COURSE_TITLE_MAX_LENGTH} characters`),
  credits: courseCredits,
  category: z
    .string()
    .trim()
    .min(1, "Pick or type a category")
    .max(CATEGORY_MAX_LENGTH, `Use at most ${CATEGORY_MAX_LENGTH} characters`),
  nonCredit: z.boolean(),
  semester: z
    .number({ error: "Use a whole number" })
    .int("Use a whole number")
    .min(0, "Use a whole number")
    .max(SEMESTER_MAX, `Use ${SEMESTER_MAX} or less`)
    .nullable(),
  alternatives: z.array(typedAlternative),
  prereq: prereqText,
});

/** What a mod types for a new slot. */
export const courseInput = courseFields.superRefine(slotShapeIssues);

/** The shape checks for a stored slot with an edit applied: the code's pattern depends on the kind. */
export const mergedSlotShape = z
  .looseObject({
    kind: courseKind,
    code: z.string(),
    alternatives: z.array(z.looseObject({ code: z.string() })),
  })
  .superRefine(slotShapeIssues);

/**
 * An edit changes any of those; fields left out stay as they are. The server merges it into the
 * stored slot and checks the whole with `slotShapeIssues`, because the code's pattern depends on the kind.
 */
export const coursePatch = courseFields
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Change at least one field");

/** Hiding and showing again both need a reason for the audit log. */
export const courseHideRequest = reasonBody;

/** A curriculum as the picker lists it. */
export const modCurriculum = z.object({
  id,
  programCode: z.string(),
  programName: z.string(),
  name: z.string(),
  version: z.string(),
  effectiveFromYear: z.number().int(),
  courseCount: z.number().int().nonnegative(),
});

/** A slot as mods see it: everything, hidden ones included. */
export const modCourse = z.object({
  id,
  curriculumId: id,
  kind: courseKind,
  code: z.string(),
  title: z.string(),
  credits: z.number(),
  category: z.string(),
  nonCredit: z.boolean(),
  semester: z.number().int().nullable(),
  alternatives: z.array(z.object({ code: z.string(), title: z.string() })),
  prereq: prereqRule.nullable(),
  hidden: z.boolean(),
});

/** The 409 and 400 codes a course write can answer with, each shown on its own field. */
export const courseConflict = z.enum(["code_taken", "code_referenced", "prereq_unknown"]);

export type CourseFormValues = z.input<typeof courseInput>;
export type CourseInput = z.output<typeof courseInput>;
export type CoursePatch = z.output<typeof coursePatch>;
export type ModCurriculum = z.infer<typeof modCurriculum>;
export type ModCourse = z.infer<typeof modCourse>;
