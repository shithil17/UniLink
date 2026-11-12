import type { PushSender } from "../../adapters/push";
import type { Db } from "../../db/client";
import { notify } from "../../notify";
import { resourceRequestsRepo, resourceSubmissionsRepo } from "../../repos/resources";

type Opts = { now: number; push?: PushSender | null };

/**
 * Tells students who took what a request asks about. Runs once a request is published: right after
 * the screen passes it, or when a mod approves it. A request that is no longer open is skipped.
 * The payload is the request id only; the requester is never told who or how many were notified.
 */
export async function announceRequest(db: Db, requestId: number, opts: Opts): Promise<void> {
  const repo = resourceRequestsRepo(db);
  const request = await repo.find(requestId);
  if (
    !request ||
    request.status !== "published" ||
    request.deletedAt !== null ||
    request.fulfilledAt !== null ||
    request.expiresAt <= opts.now
  ) {
    return;
  }
  const userIds = await repo.matchingUserIds(request.authorId, {
    courseCode: request.courseCode,
    facultyId: request.facultyId,
  });
  await notify(db, userIds, "resource_requested", { requestId }, opts);
}

/** Tells the requester a link arrived. Runs once the link is published (after the screen or a mod's approval). */
export async function announceSubmission(db: Db, submissionId: number, opts: Opts): Promise<void> {
  const submission = await resourceSubmissionsRepo(db).find(submissionId);
  if (!submission || submission.status !== "published" || submission.deletedAt !== null) return;
  const request = await resourceRequestsRepo(db).find(submission.requestId);
  if (!request || request.deletedAt !== null || request.fulfilledAt !== null) return;
  await notify(db, [request.authorId], "resource_submitted", { requestId: request.id }, opts);
}
