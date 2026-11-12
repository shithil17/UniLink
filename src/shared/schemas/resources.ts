import { z } from "zod";
import { instant, page, postStatus } from "./common";
import { courseCodeInput } from "./courses";
import { facultyLabel } from "./faculty";
import { RESOURCE_URL_MAX_LENGTH, isAllowedResourceUrl } from "../urlAllowlist";

/** A request or submission note: a sentence or two, screened like any post. */
export const RESOURCE_NOTE_MAX_LENGTH = 300;
/** A request must stay open at least this long, so it can be seen before it lapses. */
export const RESOURCE_EXPIRY_MIN_MS = 60 * 60 * 1000;
/** A request can stay open at most this many days. */
export const RESOURCE_EXPIRY_MAX_DAYS = 60;
export const RESOURCE_EXPIRY_MAX_MS = RESOURCE_EXPIRY_MAX_DAYS * 24 * 60 * 60 * 1000;
/** A fulfilled request (and its links) is deleted this many days after the requester accepted a link. The screens say so. */
export const RESOURCE_FULFILLED_KEEP_DAYS = 90;
export const RESOURCE_FULFILLED_KEEP_MS = RESOURCE_FULFILLED_KEEP_DAYS * 24 * 60 * 60 * 1000;

// Not `id` from common.ts: that one coerces, which would give the form fields an unknown input type.
const facultyId = z.number().int().positive();

const note = z
  .string()
  .trim()
  .max(RESOURCE_NOTE_MAX_LENGTH, `Keep the note under ${RESOURCE_NOTE_MAX_LENGTH} characters`);

/**
 * A request needs a course, a faculty member, or both. `expiresAt` is the instant it lapses (UTC epoch
 * ms); the server checks it against the minimum and maximum, which depend on the clock.
 */
export const resourceRequestInput = z
  .object({
    courseCode: courseCodeInput.optional(),
    facultyId: facultyId.optional(),
    note: note.optional(),
    expiresAt: instant,
  })
  .refine((r) => r.courseCode !== undefined || r.facultyId !== undefined, {
    message: "A request needs a course, a faculty, or both",
  });

/** A link on the allowlist in `src/shared/urlAllowlist.ts`: https only. */
export const resourceUrl = z
  .string()
  .trim()
  .max(RESOURCE_URL_MAX_LENGTH, "That link is too long")
  .refine(
    isAllowedResourceUrl,
    "Use an https link from Google Drive, Dropbox, OneDrive, MEGA or GitHub",
  );

export const resourceSubmissionInput = z.object({ url: resourceUrl, note: note.optional() });

export const resourceRequestState = z.enum(["open", "fulfilled", "expired"]);
export const resourceDecision = z.enum(["open", "accepted", "rejected"]);

/** A request as anyone who may see it reads it: no link, no submissions. */
export const resourceRequest = z.object({
  id: z.number().int(),
  courseCode: z.string().nullable(),
  facultyId: z.number().int().nullable(),
  faculty: facultyLabel.nullable(),
  note: z.string().nullable(),
  /** The moderation status of the request itself. */
  status: postStatus,
  /** Worked out when it is read: a request past `expiresAt` is `expired`, never `open`. */
  state: resourceRequestState,
  expiresAt: instant,
  fulfilledAt: instant.nullable(),
  createdAt: instant,
});

/** A link as the requester sees it. Only the requester gets `url`. */
export const resourceSubmissionForRequester = z.object({
  id: z.number().int(),
  url: z.string(),
  note: z.string().nullable(),
  /** The uploader's public handle. */
  uploader: z.string(),
  decision: resourceDecision,
  /** Whether the sender took the request's faculty member (and its course, if it names one). Null when the request names no faculty. */
  sameFaculty: z.boolean().nullable(),
  createdAt: instant,
});

/** The requester's own request with the links sent to it (only those that passed screening). */
export const myResourceRequest = resourceRequest.extend({
  submissions: z.array(resourceSubmissionForRequester),
});

/** What the submitter sees of their own link. */
export const resourceSubmissionOwn = z.object({
  id: z.number().int(),
  url: z.string(),
  note: z.string().nullable(),
  status: postStatus,
  decision: resourceDecision,
  createdAt: instant,
});

/** One request for the screen a notification opens. Never carries another student's link. */
export const resourceRequestDetail = resourceRequest.extend({
  mine: z.boolean(),
  mySubmissions: z.array(resourceSubmissionOwn),
});

/**
 * An open request the student can help with. `sameFaculty` is true when they had the request's faculty
 * member (for that course, if it names one); `myLinks` is how many links they already sent. Never
 * carries the requester's identity or any link.
 */
export const helpableResourceRequest = resourceRequest.extend({
  sameFaculty: z.boolean(),
  myLinks: z.number().int(),
});

export const helpableResourceRequestList = z.object({ items: z.array(helpableResourceRequest) });

export const myResourceRequestPage = page(myResourceRequest);

export type ResourceRequestInput = z.output<typeof resourceRequestInput>;
export type ResourceRequestFormValues = z.input<typeof resourceRequestInput>;
export type ResourceSubmissionInput = z.output<typeof resourceSubmissionInput>;
export type ResourceRequest = z.infer<typeof resourceRequest>;
export type HelpableResourceRequest = z.infer<typeof helpableResourceRequest>;
export type HelpableResourceRequestList = z.infer<typeof helpableResourceRequestList>;
export type MyResourceRequest = z.infer<typeof myResourceRequest>;
export type ResourceRequestDetail = z.infer<typeof resourceRequestDetail>;
export type ResourceSubmissionForRequester = z.infer<typeof resourceSubmissionForRequester>;
