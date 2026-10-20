import type { ModeratedPostTable } from "../repos/moderatedPosts";

/** One kind of user-written post, as the review queue and the mod decisions see it. */
export type ModeratedPostType = {
  table: ModeratedPostTable;
  /**
   * The text that was screened, one entry per field, taken from the whole row. The queue shows it to
   * mods. Return the screened fields only: never a contact detail, a grade or a private field.
   */
  screenedText(row: Record<string, unknown>): string[];
};

export type ModeratedPostTypes = Readonly<Record<string, ModeratedPostType>>;

/**
 * Every post type that goes through screening, keyed by the target type written to the audit log.
 * A post type adds one line here when it ships; its table needs `id`, `author_id`, the shared
 * `moderationColumns` and `deleted_at`. The mod queue, approve and reject, and "ask a moderator" then
 * work on it with no other change. Empty until the first post type exists.
 */
export const moderatedPostTypes: ModeratedPostTypes = {};

/** The registered type for a key from a request. Own keys only, so "constructor" is not a post type. */
export function postTypeOf(types: ModeratedPostTypes, key: string): ModeratedPostType | undefined {
  return Object.hasOwn(types, key) ? types[key] : undefined;
}
