// Rules every user-written post type (rides, lost and found, marketplace) shares, kept in shared code so
// the confirm dialog and the server say the same thing.

/** How long an author-deleted post stays hidden before the cron hard-deletes it, in days. A post with an open report waits for the report. */
export const AUTHOR_DELETE_PURGE_DAYS = 7;
export const AUTHOR_DELETE_PURGE_MS = AUTHOR_DELETE_PURGE_DAYS * 24 * 60 * 60 * 1000;

/** The audit reason of an author deleting their own post. A reversal refuses a soft delete that carries it. */
export const AUTHOR_DELETE_REASON = "author";

/** How many days a post with no date of its own (a recurring ride's end date) stays up, and how far one renewal pushes it. The screens state both. */
export const POST_DEFAULT_EXPIRY_DAYS = 60;
export const POST_RENEW_EXTEND_DAYS = 60;
