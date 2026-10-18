import { z } from "zod";
import { id, instant, postStatus } from "./common";

// Stub. Links must be https and on src/shared/urlAllowlist.ts.

export const resourceRequestInput = z
  .object({
    courseCode: z.string().optional(),
    facultyId: id.optional(),
    note: z.string().optional(),
    expiresAt: instant,
  })
  .refine((r) => r.courseCode !== undefined || r.facultyId !== undefined, {
    message: "A request needs a course, a faculty, or both",
  });

export const resourceSubmissionInput = z.object({ url: z.url(), note: z.string().optional() });

export const resourceRequest = z.object({
  id,
  courseCode: z.string().nullable(),
  facultyId: id.nullable(),
  note: z.string().nullable(),
  status: postStatus,
  expiresAt: instant,
});
