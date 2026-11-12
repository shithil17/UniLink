import type { Context } from "hono";
import type { SubmitResult } from "../moderation/submit";

/**
 * The 429 for a post that may not be made yet (`submitPost()` answered `ok: false`): a new account, or
 * the probing cooldown. Every post type answers it the same way.
 */
export function postBlocked(c: Context, blocked: Extract<SubmitResult, { ok: false }>) {
  c.header("Retry-After", String(Math.ceil(blocked.retryAfterMs / 1000)));
  return c.json(
    {
      error: blocked.reason,
      message:
        blocked.reason === "new_account"
          ? "New accounts can post after their first day. Try again later."
          : "You can post again shortly. Try again later.",
    },
    429,
  );
}
