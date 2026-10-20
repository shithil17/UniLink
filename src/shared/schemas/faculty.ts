import { z } from "zod";
import { departmentCode } from "../departments.ts";
import { id } from "./common.ts";
import { reasonBody } from "./moderation.ts";

// ceiling: the longest NSU faculty name and designation run to a few words; these only stop a pasted wall of text. Defined here for the client form. Revisit if a real name is refused.
export const FACULTY_NAME_MAX_LENGTH = 100;
export const FACULTY_DESIGNATION_MAX_LENGTH = 60;
// ceiling: NSU initials are 2 to 6 letters and digits ("RkZ", "SfR1"). Revisit if NSU issues longer codes.
export const FACULTY_INITIALS_MIN_LENGTH = 2;
export const FACULTY_INITIALS_MAX_LENGTH = 6;
// ceiling: a profile URL on northsouth.edu is well under this. Revisit if a profile link is refused.
export const FACULTY_PAGE_MAX_LENGTH = 200;

const NSU_HOST = "northsouth.edu";

/** True for an https URL on northsouth.edu or one of its subdomains. */
export function isNsuPage(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === NSU_HOST || url.hostname.endsWith(`.${NSU_HOST}`))
    );
  } catch {
    return false;
  }
}

export const facultyInitials = z
  .string()
  .regex(
    new RegExp(`^[A-Za-z0-9]{${FACULTY_INITIALS_MIN_LENGTH},${FACULTY_INITIALS_MAX_LENGTH}}$`),
    `Use ${FACULTY_INITIALS_MIN_LENGTH} to ${FACULTY_INITIALS_MAX_LENGTH} letters or digits`,
  );

const nsuPageUrl = z
  .string()
  .max(FACULTY_PAGE_MAX_LENGTH, `Use at most ${FACULTY_PAGE_MAX_LENGTH} characters`)
  .refine(isNsuPage, "Use an https link on northsouth.edu");

/** A form text box: trimmed, and empty means "not given" (null). */
const optionalText = (inner: z.ZodString) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(inner.nullable());

export const facultySummary = z.object({
  id,
  slug: z.string(),
  name: z.string(),
  initials: z.string().nullable(),
  designation: z.string(),
  tags: z.array(z.string()),
  limitedData: z.boolean(),
});

/** What the attempt picker needs to show a faculty member. */
export const facultyOption = facultySummary
  .pick({ id: true, name: true, initials: true, designation: true })
  .extend({ department: departmentCode });

/** The label an attempt row carries for its faculty member, even after the row is hidden from the picker. */
export const facultyLabel = facultyOption.pick({ name: true, initials: true });

/** One entry of `data/faculty.json`. */
export const facultySeedEntry = facultyOption.omit({ id: true }).extend({
  nsuPage: nsuPageUrl.nullable().optional(),
});

/** What a mod types: empty initials and NSU page mean none. */
export const facultyInput = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the name")
    .max(FACULTY_NAME_MAX_LENGTH, `Use at most ${FACULTY_NAME_MAX_LENGTH} characters`),
  initials: optionalText(facultyInitials),
  designation: z
    .string()
    .trim()
    .min(2, "Enter the designation")
    .max(
      FACULTY_DESIGNATION_MAX_LENGTH,
      `Use at most ${FACULTY_DESIGNATION_MAX_LENGTH} characters`,
    ),
  department: departmentCode,
  nsuPage: optionalText(nsuPageUrl),
});

/** An edit changes any of those; fields left out stay as they are. */
export const facultyPatch = facultyInput
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Change at least one field");

/** A faculty member as mods see them: everything, hidden ones included. */
export const modFaculty = facultyOption.extend({
  nsuPage: z.string().nullable(),
  hidden: z.boolean(),
});

/** Hiding and showing again both need a reason for the audit log. */
export const facultyHideRequest = reasonBody;

/** The 409 codes a faculty write can answer with, each shown on its own field. */
export const facultyConflict = z.enum(["initials_taken", "name_taken"]);

export const facultySummaryUpdate = z.object({
  summary: z.string(),
  tags: z.array(z.string()),
  limitedData: z.boolean(),
});

export const finderCourse = z.enum(["CSE299", "CSE499", "CSE498R"]);

export const finderMatchRequest = z.object({
  text: z.string(),
  course: finderCourse.optional(),
});

/** Reply text is built by the server; cards reference faculty that exist and are visible. */
export const finderMatchResponse = z.object({
  reply: z.string(),
  results: z.array(
    facultySummary.pick({
      id: true,
      slug: true,
      name: true,
      initials: true,
      designation: true,
      tags: true,
    }),
  ),
});

export type FacultyOption = z.infer<typeof facultyOption>;
export type FacultySeedEntry = z.infer<typeof facultySeedEntry>;
export type FacultyLabel = z.infer<typeof facultyLabel>;
export type FacultyFormValues = z.input<typeof facultyInput>;
export type FacultyInput = z.output<typeof facultyInput>;
export type FacultyPatch = z.output<typeof facultyPatch>;
export type ModFaculty = z.infer<typeof modFaculty>;
