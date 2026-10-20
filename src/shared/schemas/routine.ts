import { z } from "zod";
import { ROUTINE_DAYS, timeToMinutes } from "../routine.ts";
import { id, term } from "./common.ts";
import { courseCodeInput } from "./courses.ts";

// Field sizes live here so the client form and the server share them; limits.ts re-exports them.
export const ROUTINE_SECTION_MAX = 99;
export const ROUTINE_ROOM_MAX_LENGTH = 20;
export const ROUTINE_INITIALS_MAX_LENGTH = 10;

const dayLetter = z.enum(ROUTINE_DAYS);

/** "HH:MM", 24 hour, Asia/Dhaka local time. */
export const routineTime = z
  .string()
  .trim()
  .refine((v) => timeToMinutes(v) !== null, "Use a time like 09:30");

const entryFields = z.object({
  courseCode: courseCodeInput,
  section: z.number().int().min(1).max(ROUTINE_SECTION_MAX),
  days: z
    .array(dayLetter)
    .min(1, "Pick at least one day")
    .refine((d) => new Set(d).size === d.length, "Each day once"),
  start: routineTime,
  end: routineTime,
  /** Free text as printed on the NSU routine. Not screened: the routine is never sent to a model. */
  room: z.string().trim().max(ROUTINE_ROOM_MAX_LENGTH).optional(),
  initials: z.string().trim().max(ROUTINE_INITIALS_MAX_LENGTH).optional(),
});

/** End must be after start. Checked on the minutes, so "9:30" and "09:30" compare the same. */
export const endAfterStart = (v: { start: string; end: string }) =>
  (timeToMinutes(v.end) ?? 0) > (timeToMinutes(v.start) ?? 0);
const END_AFTER_START = "The class must end after it starts";

/** A new entry. Without `term` it goes into the current term. */
export const routineInput = entryFields
  .extend({ term: term.optional() })
  .refine(endAfterStart, { message: END_AFTER_START, path: ["end"] });

/** An edit changes any field except the term. The server checks the times together with the saved ones. */
export const routineUpdate = entryFields
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Change at least one field");

/** The term to list or clear. Both parts together, or neither for the current term. */
export const routineTermQuery = z
  .object({
    year: z.coerce.number().int().optional(),
    season: term.shape.season.optional(),
  })
  .refine((v) => (v.year === undefined) === (v.season === undefined), "Give year and season");

export const routineEntry = z.object({
  id,
  term,
  courseCode: z.string(),
  section: z.number().int(),
  days: z.array(dayLetter),
  start: routineTime,
  end: routineTime,
  room: z.string(),
  initials: z.string(),
});

export type RoutineInput = z.infer<typeof routineInput>;
export type RoutineUpdate = z.infer<typeof routineUpdate>;
export type RoutineEntry = z.infer<typeof routineEntry>;
