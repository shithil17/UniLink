import { z } from "zod";
import { ATTEMPT_GRADES } from "../grading";
import { id, term } from "./common";
import { courseCodeInput } from "./courses";

/** A letter grade, or "WV" for a waived course. */
export const letterGrade = z.enum(ATTEMPT_GRADES);

// Not `id` from common.ts: that one coerces, which would give the form fields an unknown input type.
const facultyId = z.number().int().positive();

/**
 * Quick attempt form on the course map: course and grade, with term and faculty optional.
 * This is also the shape the API accepts, so the quick form keeps working.
 */
export const attemptInput = z.object({
  courseCode: courseCodeInput,
  grade: letterGrade,
  term: term.nullable().optional(),
  facultyId: facultyId.nullable().optional(),
});

/** The full attempt form: the same, but a new attempt must say which term it was taken in. */
export const attemptFullInput = attemptInput.extend({
  term: term,
});

/** An edit changes the grade, term or faculty. The course is fixed once recorded. */
export const attemptUpdate = z
  .object({
    grade: letterGrade.optional(),
    term: term.nullable().optional(),
    facultyId: facultyId.nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Change at least one field");

export const attemptListQuery = z.object({ courseCode: courseCodeInput.optional() });

export const attempt = z.object({
  id,
  courseCode: z.string(),
  grade: letterGrade,
  term: term.nullable(),
  facultyId: facultyId.nullable(),
  createdAt: z.number().int(),
});

/** Credits per category: `remaining` is what the curriculum still asks for (never below 0). */
export const categoryCredits = z.object({
  name: z.string(),
  required: z.number(),
  earned: z.number(),
  remaining: z.number(),
});

export const cgpaSummary = z.object({
  /** Null until there is a graded attempt that counts. */
  cgpa: z.number().nullable(),
  /** Credits of the courses behind the CGPA. */
  gradedCredits: z.number(),
  /** Same figure as the course map's degree total, so the two screens agree. */
  earnedCredits: z.number(),
  requiredCredits: z.number(),
  remainingCredits: z.number(),
  categories: z.array(categoryCredits),
});

export type AttemptInput = z.infer<typeof attemptInput>;
export type AttemptFullInput = z.infer<typeof attemptFullInput>;
export type AttemptUpdate = z.infer<typeof attemptUpdate>;
export type Attempt = z.infer<typeof attempt>;
export type CgpaSummary = z.infer<typeof cgpaSummary>;
