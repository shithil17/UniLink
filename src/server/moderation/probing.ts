import type { Db } from "../db/client";
import { limits } from "../limits";
import { canPost } from "../middleware/canPost";
import { rateLimit } from "../middleware/rateLimit";
import type { SessionUser } from "../middleware/types";
import { usersRepo } from "../repos/users";

export type MayPost =
  | { ok: true }
  | { ok: false; reason: "new_account" | "cooldown"; retryAfterMs: number };

/**
 * Call before creating or editing any user-written post. Combines the new-account wait (`canPost`)
 * with the probing cooldown. The caller answers 429 with `retryAfterMs` when `ok` is false.
 */
export async function mayPost(
  db: Db,
  user: Pick<SessionUser, "id" | "createdAt">,
  now: number = Date.now(),
): Promise<MayPost> {
  const newAccount = canPost(user, now);
  if (!newAccount.ok)
    return { ok: false, reason: "new_account", retryAfterMs: newAccount.retryAfterMs };

  const state = await usersRepo(db).probingState(user.id);
  const until = state?.postingBlockedUntil ?? 0;
  return until > now ? { ok: false, reason: "cooldown", retryAfterMs: until - now } : { ok: true };
}

/**
 * Call when the screen rejects a user's post (not when a mod does). Counts the rejection through
 * `rateLimit()`; the third in an hour starts the posting cooldown and flags the user for the mod panel.
 * Returns true when this rejection triggered the cooldown.
 *
 * ceiling: the count is a fixed window, so rejections split across a window boundary do not add up.
 * Revisit if probing slips through that gap.
 */
export async function recordRejection(
  db: Db,
  userId: number,
  now: number = Date.now(),
): Promise<boolean> {
  const { rejections, windowMs, cooldownMs } = limits.probing;
  const hit = await rateLimit(db, `probe:${userId}`, rejections, windowMs, now);
  if (hit.count < rejections) return false;
  await usersRepo(db).blockPosting(userId, now + cooldownMs, now);
  return true;
}
