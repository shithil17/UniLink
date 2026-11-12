import type { z } from "zod";
import type {
  resourceRequest,
  resourceSubmissionForRequester,
  resourceSubmissionOwn,
} from "../../../shared/schemas/resources";
import type {
  ResourceRequestWithFaculty,
  ResourceSubmissionRow,
  SubmissionWithUploader,
} from "../../repos/resources";

type RequestView = z.infer<typeof resourceRequest>;
type RequesterSubmissionView = z.infer<typeof resourceSubmissionForRequester>;
type OwnSubmissionView = z.infer<typeof resourceSubmissionOwn>;

/**
 * Where a request stands at `now`. Worked out when it is read, so a request past its expiry never
 * shows as open even before the cron has purged it.
 */
export function requestState(
  r: Pick<ResourceRequestWithFaculty, "fulfilledAt" | "expiresAt">,
  now: number,
): RequestView["state"] {
  if (r.fulfilledAt !== null) return "fulfilled";
  return r.expiresAt <= now ? "expired" : "open";
}

/** A request as anyone who may see it reads it. Never carries a link or another student's identity. */
export function toRequestView(r: ResourceRequestWithFaculty, now: number): RequestView {
  return {
    id: r.id,
    courseCode: r.courseCode,
    facultyId: r.facultyId,
    faculty:
      r.facultyId !== null && r.facultyName !== null
        ? { name: r.facultyName, initials: r.facultyInitials }
        : null,
    note: r.note,
    status: r.status,
    state: requestState(r, now),
    expiresAt: r.expiresAt,
    fulfilledAt: r.fulfilledAt,
    createdAt: r.createdAt,
  };
}

/** The decision on a link: accepted when it is the one the request was fulfilled with. */
export function submissionDecision(
  s: Pick<ResourceSubmissionRow, "id" | "rejectedAt">,
  acceptedSubmissionId: number | null,
): OwnSubmissionView["decision"] {
  if (acceptedSubmissionId === s.id) return "accepted";
  return s.rejectedAt !== null ? "rejected" : "open";
}

/** A link as the requester sees it: the URL and the uploader's handle. */
export function toRequesterSubmission(
  s: SubmissionWithUploader,
  acceptedSubmissionId: number | null,
): RequesterSubmissionView {
  return {
    id: s.id,
    url: s.url,
    note: s.note,
    uploader: s.uploader ?? "",
    decision: submissionDecision(s, acceptedSubmissionId),
    sameFaculty: s.sameFaculty,
    createdAt: s.createdAt,
  };
}

/** A link as its uploader sees it. */
export function toOwnSubmission(
  s: ResourceSubmissionRow,
  acceptedSubmissionId: number | null,
): OwnSubmissionView {
  return {
    id: s.id,
    url: s.url,
    note: s.note,
    status: s.status,
    decision: submissionDecision(s, acceptedSubmissionId),
    createdAt: s.createdAt,
  };
}
