import { resourceRequests, resourceSubmissions } from "../../db/schema";
import type { ModeratedPostType } from "../../moderation/postTypes";
import { announceRequest, announceSubmission } from "./announce";

/** The note, for the mod queue. A request has no link of its own. */
const noteOnly = (row: Record<string, unknown>): string[] =>
  typeof row.note === "string" && row.note !== "" ? [row.note] : [];

/**
 * The link first, then the note. The link is checked by the shared URL rule rather than screened as
 * text, but a mod approving a held link has to see where it points, even when it has no note.
 */
const urlThenNote = (row: Record<string, unknown>): string[] => [
  ...(typeof row.url === "string" && row.url !== "" ? [row.url] : []),
  ...noteOnly(row),
];

export const resourceRequestPostType: ModeratedPostType = {
  table: resourceRequests,
  screenedText: noteOnly,
  // A held request is announced when a mod approves it, not before.
  afterApprove: (db, id, opts) => announceRequest(db, id, opts),
};

export const resourceSubmissionPostType: ModeratedPostType = {
  table: resourceSubmissions,
  screenedText: urlThenNote,
  afterApprove: (db, id, opts) => announceSubmission(db, id, opts),
};
