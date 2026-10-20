import { z } from "zod";
import type { PrereqRule } from "../prereq.ts";
import { NSU_PROGRAM_CODES } from "../studentId.ts";
import { id } from "./common.ts";

// Curriculum import, the course map, and the student's own courses. One shape for client and server.

export type { PrereqRule };

/** A fixed course: 2 to 4 capital letters, 3 digits, an optional letter (CSE115, CSE115L). */
export const COURSE_CODE_PATTERN = /^[A-Z]{2,4}\d{3}[A-Z]?$/;
/** An elective placeholder: ELECT1, OPEN-ELECT, a BBA major slot. */
export const ELECTIVE_CODE_PATTERN = /^[A-Z][A-Z0-9-]{1,15}$/;
// ceiling: no NSU course is worth more than this. Revisit if a thesis or internship map says otherwise.
export const COURSE_CREDITS_MAX = 24;
// ceiling: a curriculum has well under 20 semesters. Revisit if a program map counts them differently.
export const SEMESTER_MAX = 20;

export const text = (max: number) => z.string().trim().min(1).max(max);

/** Credits come in halves (3, 1.5, 0 for a non-credit course). */
export const courseCredits = z
  .number({ error: "Enter the credits" })
  .min(0)
  .max(COURSE_CREDITS_MAX)
  .refine((n) => Number.isInteger(n * 2), "Credits must be a multiple of 0.5");

/** A course code exactly as written in a data file. */
const strictCourseCode = z.string().regex(COURSE_CODE_PATTERN, "Invalid course code");

/** A course code typed by a student: trimmed and upper-cased first. */
export const courseCodeInput = z
  .string()
  .trim()
  .toUpperCase()
  .regex(COURSE_CODE_PATTERN, "Course codes look like CSE115");

// Prerequisites. A leaf is a course or a count of degree credits; groups nest.

export const prereqRule: z.ZodType<PrereqRule> = z.lazy(() =>
  z.union(
    [
      z.strictObject({ course: strictCourseCode }),
      z.strictObject({ credits: z.number().positive() }),
      z.strictObject({ all: z.array(prereqRule) }),
      z.strictObject({ any: z.array(prereqRule) }),
    ],
    { error: "A prerequisite is {course}, {credits}, {all: [...]} or {any: [...]}" },
  ),
);

export const courseKind = z.enum(["course", "elective"]);
export const courseStatus = z.enum(["done", "available", "locked"]);

// Import. The header is checked strictly; each row is checked on its own so one bad row does not
// stop the rest.

export const alternative = z.strictObject({ code: strictCourseCode, title: text(200) });

/**
 * The checks a slot must pass whatever its source (a file row or the mod editor): the code matches
 * its kind, an elective has no alternatives, and alternatives never repeat or name the slot's own code.
 */
export function slotShapeIssues(
  row: { kind: "course" | "elective"; code: string; alternatives: readonly { code: string }[] },
  ctx: z.RefinementCtx,
): void {
  const pattern = row.kind === "course" ? COURSE_CODE_PATTERN : ELECTIVE_CODE_PATTERN;
  if (!pattern.test(row.code)) {
    ctx.addIssue({
      code: "custom",
      path: ["code"],
      message:
        row.kind === "course"
          ? "Course codes look like CSE115 or CSE115L"
          : "Elective codes are capital letters, digits and dashes, like ELECT1",
    });
  }
  if (row.kind === "elective" && row.alternatives.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["alternatives"],
      message: "An elective has no alternatives",
    });
  }
  const codes = row.alternatives.map((a) => a.code);
  if (new Set(codes).size !== codes.length || codes.includes(row.code)) {
    ctx.addIssue({
      code: "custom",
      path: ["alternatives"],
      message: "Alternatives repeat a code",
    });
  }
}

export const courseImportRow = z
  .strictObject({
    kind: courseKind,
    code: z.string(),
    title: text(200),
    credits: courseCredits,
    category: text(100),
    nonCredit: z.boolean(),
    semester: z.number().int().min(0).max(SEMESTER_MAX).nullable(),
    alternatives: z.array(alternative),
    prereq: prereqRule.nullable(),
  })
  .superRefine(slotShapeIssues);

// Elective trails. A header block: trail lists are not slots, so a bad block rejects the whole file.

export const electiveTrailCourse = z.strictObject({
  code: strictCourseCode,
  title: text(200),
  credits: courseCredits,
});

export const electiveTrail = z.strictObject({
  name: text(100),
  courses: z.array(electiveTrailCourse).min(1, "A trail needs at least one course"),
});

/** The trail checks that need nothing but the block itself. */
export function electiveTrailsIssues(block: ElectiveTrailsShape): string[] {
  const issues: string[] = [];
  const names = block.trails.map((t) => t.name);
  if (new Set(names).size !== names.length) issues.push("Two trails share a name");
  const seen = new Set<string>();
  for (const code of block.trails.flatMap((t) => t.courses.map((c) => c.code))) {
    if (seen.has(code)) issues.push(`Trail course ${code} appears more than once`);
    seen.add(code);
  }
  const largest = Math.max(0, ...block.trails.map((t) => t.courses.length));
  if (block.minFromOneTrail > largest) {
    issues.push(
      `minFromOneTrail ${block.minFromOneTrail} is more than the largest trail (${largest})`,
    );
  }
  return issues;
}

type ElectiveTrailsShape = {
  minFromOneTrail: number;
  trails: { name: string; courses: { code: string }[] }[];
};

/**
 * The trail checks that need the file's slots: the category is one an elective slot is filed under,
 * and no trail course reuses a slot code or an alternative. Run on the accepted rows by the import route.
 */
export function electiveTrailsRowIssues(
  block: { category: string; trails: ElectiveTrailsShape["trails"] },
  rows: readonly {
    kind: "course" | "elective";
    code: string;
    category: string;
    alternatives: readonly { code: string }[];
  }[],
): string[] {
  const issues: string[] = [];
  if (!rows.some((r) => r.kind === "elective" && r.category === block.category)) {
    issues.push(`Trail category "${block.category}" is not the category of any elective slot`);
  }
  const used = new Set(rows.flatMap((r) => [r.code, ...r.alternatives.map((a) => a.code)]));
  for (const code of block.trails.flatMap((t) => t.courses.map((c) => c.code))) {
    if (used.has(code)) issues.push(`Trail course ${code} is also a slot code or an alternative`);
  }
  return issues;
}

export const electiveTrails = z
  .strictObject({
    /** The category of the elective slots the trails fill. */
    category: text(100),
    /** Courses from one trail a student needs. Shown, never enforced. */
    minFromOneTrail: z.number().int().min(1),
    trails: z.array(electiveTrail).min(1, "Add at least one trail"),
  })
  .superRefine((block, ctx) => {
    for (const message of electiveTrailsIssues(block)) {
      ctx.addIssue({ code: "custom", message, path: [] });
    }
  });

export const curriculumHeader = z.strictObject({
  program: z
    .string()
    .refine((p) => Object.hasOwn(NSU_PROGRAM_CODES, p), "Unknown NSU program code"),
  name: text(200),
  version: text(50),
  /** Admission year (YY) this version applies from. */
  effectiveFromYear: z.number().int().min(0).max(99),
  totalCredits: z
    .number()
    .positive()
    .max(COURSE_CREDITS_MAX * SEMESTER_MAX),
  source: z.string().optional(),
  notes: z.array(z.string()).optional(),
  electiveTrails: electiveTrails.optional(),
});

/** What the import route validates first: the header, with the rows left for per-row checks. */
export const curriculumImportEnvelope = curriculumHeader.extend({ courses: z.array(z.unknown()) });

/** A whole curriculum file; every row must be valid. */
export const curriculumImport = curriculumHeader
  .extend({ courses: z.array(courseImportRow) })
  .superRefine((file, ctx) => {
    if (!file.electiveTrails) return;
    for (const message of electiveTrailsRowIssues(file.electiveTrails, file.courses)) {
      ctx.addIssue({ code: "custom", message, path: ["electiveTrails"] });
    }
  });

export const importRejection = z.object({
  /** Position of the row in the file's `courses` array. */
  index: z.number().int().nonnegative(),
  code: z.string().nullable(),
  reason: z.string(),
});

export const importResult = z.object({
  curriculumId: id,
  imported: z.number().int().nonnegative(),
  rejected: z.array(importRejection),
});

// Student courses: the student's own electives. The code is fixed once added (attempts hang on it).

const studentCourseFields = z.object({
  title: text(200),
  credits: courseCredits.min(0.5, "Credits must be at least 0.5"),
  category: text(100),
  excluded: z.boolean(),
});

export const studentCourseInput = studentCourseFields.extend({
  code: courseCodeInput,
  excluded: z.boolean().default(false),
});

// Built from the fields without the `excluded` default, so an edit that omits it leaves it alone.
export const studentCourseUpdate = studentCourseFields
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const studentCourse = z.object({
  id,
  code: z.string(),
  title: z.string(),
  credits: z.number(),
  category: z.string(),
  excluded: z.boolean(),
  createdAt: z.number().int(),
});

// The course map.

export const courseMapStudentCourse = studentCourse.extend({
  /** The student has a passing attempt for it. */
  done: z.boolean(),
  /** Done only through a waiver: credits count, CGPA does not. */
  waived: z.boolean(),
});

export const courseMapSlot = z.object({
  kind: courseKind,
  code: z.string(),
  title: z.string(),
  credits: z.number(),
  category: z.string(),
  nonCredit: z.boolean(),
  semester: z.number().int().nullable(),
  alternatives: z.array(z.object({ code: z.string(), title: z.string() })),
  prereq: prereqRule.nullable(),
  status: courseStatus,
  /** The code of the passing attempt that filled a course slot: the slot code or one of its alternatives. */
  filledBy: z.string().nullable(),
  /** The slot or alternative code the student took, even if not passed yet. Null until one has an attempt. */
  chosenCode: z.string().nullable(),
  /** The slot is done only through a waiver. */
  waived: z.boolean(),
  /** The student course filling an elective slot. */
  studentCourse: courseMapStudentCourse.nullable(),
});

export const trailCourseState = z.enum(["done", "added"]);

export const courseMapTrail = z.object({
  name: z.string(),
  /** Courses in this trail the student has passed. */
  done: z.number().int(),
  /** Courses in this trail the student added and has not passed yet. */
  added: z.number().int(),
  courses: z.array(
    z.object({
      code: z.string(),
      title: z.string(),
      credits: z.number(),
      /** Null: the student has not added it. */
      state: trailCourseState.nullable(),
    }),
  ),
});

export const courseMapTrails = z.object({
  minFromOneTrail: z.number().int(),
  /** Some trail has at least `minFromOneTrail` done courses. */
  met: z.boolean(),
  /** The trail with the most done courses (ties: most added, then file order). Null if none has one. */
  leading: z.string().nullable(),
  trails: z.array(courseMapTrail),
});

export const courseMapCategory = z.object({
  name: z.string(),
  /** Credits the category needs: the sum of its slots, non-credit courses excluded. */
  required: z.number(),
  /** Credits earned in it. May exceed `required`. */
  earned: z.number(),
  slots: z.array(courseMapSlot),
  /** Trail progress, on the category the curriculum's trails fill; null on every other. */
  trails: courseMapTrails.nullable(),
});

/** `GET /api/courses/lookup?code=`: exact code. */
export const courseLookupQuery = z.object({ code: courseCodeInput });
export const courseLookup = z.object({
  code: z.string(),
  title: z.string(),
  credits: z.number(),
  /** The trail it belongs to in the student's own curriculum; null if none. */
  trail: z.string().nullable(),
});

export const courseMap = z.object({
  /** Null when no curriculum is imported for the student's program. */
  curriculum: z
    .object({
      id,
      programCode: z.string(),
      programName: z.string(),
      name: z.string(),
      version: z.string(),
      effectiveFromYear: z.number().int(),
    })
    .nullable(),
  degree: z.object({ required: z.number(), earned: z.number() }),
  categories: z.array(courseMapCategory),
  /** Student courses beyond the elective placeholders, and every excluded one. */
  extras: z.array(courseMapStudentCourse),
});

export type CourseStatus = z.infer<typeof courseStatus>;
export type CurriculumImport = z.infer<typeof curriculumImport>;
export type CourseImportRow = z.infer<typeof courseImportRow>;
export type ImportResult = z.infer<typeof importResult>;
export type StudentCourseInput = z.infer<typeof studentCourseInput>;
export type StudentCourse = z.infer<typeof studentCourse>;
export type CourseMap = z.infer<typeof courseMap>;
export type ElectiveTrails = z.infer<typeof electiveTrails>;
export type CourseMapTrails = z.infer<typeof courseMapTrails>;
export type CourseLookup = z.infer<typeof courseLookup>;
