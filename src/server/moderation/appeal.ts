import type { Db } from "../db/client";
import { limits } from "../limits";
import { rateLimit } from "../middleware/rateLimit";
import { moderatedPostsRepo } from "../repos/moderatedPosts";
import { moderatedPostTypes, postTypeOf, type ModeratedPostTypes } from "./postTypes";

export type AskModeratorResult =
  | { ok: true }
  | { ok: false; reason: "unknown_target" | "not_found" | "not_rejected" }
  | { ok: false; reason: "rate_limited"; retryAfterMs: number };

/**
 * "Ask a moderator to look": the author sends their own rejected post to the review queue. Rate-limited,
 * checked before the post is touched. A post that is not theirs is `not_found`, the same as a missing
 * one. Only a rejected post can be sent; a published or already-held one is `not_rejected`.
 */
export async function askModerator(
  db: Db,
  input: { userId: number; targetType: string; targetId: number },
  opts: { postTypes?: ModeratedPostTypes; now?: number } = {},
): Promise<AskModeratorResult> {
  const type = postTypeOf(opts.postTypes ?? moderatedPostTypes, input.targetType);
  if (!type) return { ok: false, reason: "unknown_target" };
  const now = opts.now ?? Date.now();

  const hit = await rateLimit(
    db,
    `appeal:${input.userId}`,
    limits.appeal.limit,
    limits.appeal.windowMs,
    now,
  );
  if (!hit.allowed) return { ok: false, reason: "rate_limited", retryAfterMs: hit.retryAfterMs };

  const repo = moderatedPostsRepo(db, type.table);
  const post = await repo.find(input.targetId);
  if (!post || post.authorId !== input.userId || post.deletedAt !== null) {
    return { ok: false, reason: "not_found" };
  }
  if (!(await repo.appeal(input.targetId, input.userId, now))) {
    return { ok: false, reason: "not_rejected" };
  }
  return { ok: true };
}
