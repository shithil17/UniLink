import { resourceRequests, resourceSubmissions } from "../../db/schema";
import type { ModeratedPostType } from "../../moderation/postTypes";
import { announceRequest, announceSubmission } from "./announce";

/** The text the screen read, for the mod queue. A link is checked by the allowlist, not screened as text. */
const noteOnly = (row: Record<string, unknown>): string[] =>
  typeof row.note === "string" && row.note !== "" ? [row.note] : [];

export const resourceRequestPostType: ModeratedPostType = {
  table: resourceRequests,
  screenedText: noteOnly,
  // A held request is announced when a mod approves it, not before.
  afterApprove: (db, id, opts) => announceRequest(db, id, opts),
};

export const resourceSubmissionPostType: ModeratedPostType = {
  table: resourceSubmissions,
  screenedText: noteOnly,
  afterApprove: (db, id, opts) => announceSubmission(db, id, opts),
};
