import { z } from "zod";
import { ATTEMPT_GRADES } from "../grading";
import { id, term } from "./common";
import { courseCodeInput } from "./courses";

// Quick attempt form: course, grade and an optional term. Faculty and the retake rules arrive with the full form.

/** A letter grade, or "WV" for a waived course. */
export const letterGrade = z.enum(ATTEMPT_GRADES);

export const attemptInput = z.object({
  courseCode: courseCodeInput,
  grade: letterGrade,
  term: term.nullable().optional(),
});

export const attempt = z.object({
  id,
  courseCode: z.string(),
  grade: letterGrade,
  term: term.nullable(),
  createdAt: z.number().int(),
});

export type AttemptInput = z.infer<typeof attemptInput>;
export type Attempt = z.infer<typeof attempt>;
