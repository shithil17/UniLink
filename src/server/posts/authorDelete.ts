import type { Context } from "hono";
import { AUTHOR_DELETE_REASON } from "../../shared/posts";
import type { Db } from "../db/client";
import { getDb } from "../db/client";
import type { AppEnv } from "../middleware/types";
import { moderatedPostTypes, postTypeOf, type ModeratedPostTypes } from "../moderation/postTypes";
import { moderatedPostsRepo } from "../repos/moderatedPosts";
import { softDelete, type SoftDeleteTargets } from "../softDelete";

export type AuthorDeleteResult = { ok: true } | { ok: false; reason: "not_found" };

/**
 * An author deleting their own post. Goes through `softDelete()` with the author as the actor and the
 * reason `author`, so the post disappears for everyone at once and the audit row is written; the
 * author is not sent a removal notice (`softDelete()` skips it when the actor is the author). The
 * type's cron job hard-deletes the row later (see `postLifecycleRepo`). A post that is not theirs, is
 * already deleted or does not exist is `not_found`, so another user learns nothing about it.
 *
 * `targetType` is the type's key in the moderated post registry and in `softDeleteTargets`.
 */
export async function authorDelete(
  db: Db,
  input: { userId: number; targetType: string; targetId: number },
  opts: { postTypes?: ModeratedPostTypes; targets?: SoftDeleteTargets; now?: number } = {},
): Promise<AuthorDeleteResult> {
  const type = postTypeOf(opts.postTypes ?? moderatedPostTypes, input.targetType);
  if (!type) return { ok: false, reason: "not_found" };

  const post = await moderatedPostsRepo(db, type.table).find(input.targetId);
  if (!post || post.authorId !== input.userId || post.deletedAt !== null) {
    return { ok: false, reason: "not_found" };
  }
  const result = await softDelete(
    db,
    {
      actor: input.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: AUTHOR_DELETE_REASON,
    },
    { targets: opts.targets, now: opts.now },
  );
  return result.ok ? { ok: true } : { ok: false, reason: "not_found" };
}

/**
 * The handler of `DELETE /api/<type>/:id`:
 *
 *   typeRoutes.use(requireUser).delete("/:id", deleteOwnPost("ride"))
 *
 * The router must sit behind `requireUser`. Answers `{ ok: true }`, or 404 for a post that is not the
 * caller's.
 */
export function deleteOwnPost(
  targetType: string,
  opts: { postTypes?: ModeratedPostTypes; targets?: SoftDeleteTargets } = {},
) {
  return async (c: Context<AppEnv>) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: "not_found" }, 404);
    const result = await authorDelete(
      getDb(c.env.DB),
      { userId: user.id, targetType, targetId: id },
      opts,
    );
    if (!result.ok) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  };
}
