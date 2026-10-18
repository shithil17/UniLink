import { z } from "zod";
import { id, term } from "./common";

// Stub. Grade points and the retake policy live in src/shared/grading.ts.

export const letterGrade = z.enum([
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "F",
  "I",
  "W",
]);

export const attemptInput = z.object({
  courseCode: z.string(),
  grade: letterGrade,
  term: term.nullable().optional(),
  facultyId: id.nullable().optional(),
});

export const attempt = attemptInput.extend({ id, createdAt: z.number().int() });
