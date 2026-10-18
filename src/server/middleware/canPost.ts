import { limits } from "../limits";
import type { SessionUser } from "./types";

export type CanPost = { ok: true } | { ok: false; retryAfterMs: number };

/**
 * New accounts cannot post or submit links until the cooldown after `created_at` has passed.
 * Call this server-side before creating any user-written post.
 */
export function canPost(user: Pick<SessionUser, "createdAt">, now: number = Date.now()): CanPost {
  const retryAfterMs = user.createdAt + limits.newAccountCooldownMs - now;
  return retryAfterMs > 0 ? { ok: false, retryAfterMs } : { ok: true };
}
