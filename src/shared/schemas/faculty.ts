import { z } from "zod";
import { id } from "./common";

export const facultySummary = z.object({
  id,
  slug: z.string(),
  name: z.string(),
  initials: z.string(),
  designation: z.string(),
  tags: z.array(z.string()),
  limitedData: z.boolean(),
});

/** What the attempt picker needs to show a faculty member. */
export const facultyOption = facultySummary.pick({
  id: true,
  name: true,
  initials: true,
  designation: true,
});

/** One entry of `data/faculty.json`. */
export const facultySeedEntry = facultyOption.omit({ id: true });

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
