import { z } from "zod";

// Stub. The rule tree is evaluated by src/shared/prereq.ts.

export type PrereqRule = { course: string } | { all: PrereqRule[] } | { any: PrereqRule[] };

export const prereqRule: z.ZodType<PrereqRule> = z.lazy(() =>
  z.union([
    z.object({ course: z.string() }),
    z.object({ all: z.array(prereqRule) }),
    z.object({ any: z.array(prereqRule) }),
  ]),
);

export const courseStatus = z.enum(["done", "available", "locked"]);

export const courseImportRow = z.object({
  code: z.string(),
  title: z.string(),
  credits: z.number(),
  category: z.string(),
  prereq: prereqRule.nullable(),
  nonCredit: z.boolean(),
  curriculumVersion: z.string(),
});

export const courseMapItem = z.object({
  code: z.string(),
  title: z.string(),
  credits: z.number(),
  category: z.string(),
  nonCredit: z.boolean(),
  prereq: prereqRule.nullable(),
  status: courseStatus,
});

export const courseMap = z.object({
  courses: z.array(courseMapItem),
  totals: z.object({ byCategory: z.record(z.string(), z.number()), earned: z.number() }),
});
