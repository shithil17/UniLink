import type { Context } from "hono";
import type { AppEnv } from "../../middleware/types";
import type { ActionFailure, Actor } from "./actions";

const FAILURES: Record<ActionFailure, { status: 403 | 404 | 409; message: string }> = {
  not_found: { status: 404, message: "That does not exist." },
  forbidden_target: { status: 403, message: "You can't do that to this account." },
  already_banned: { status: 409, message: "That account is already banned." },
  not_banned: { status: 409, message: "That account is not banned." },
  key_already_released: { status: 409, message: "That student ID was already released." },
  role_unchanged: { status: 409, message: "That account already has this role." },
  conflict: { status: 409, message: "That changed while you were working. Reload and try again." },
  already_resolved: { status: 409, message: "That report was already closed." },
};

/** The HTTP answer for a refused moderation action. */
export function actionFailure(c: Context, reason: ActionFailure) {
  const { status, message } = FAILURES[reason];
  return c.json({ error: reason, message }, status);
}

/** The signed-in mod or admin. A role guard runs first; a missing user gets the least privilege. */
export function actorOf(c: Context<AppEnv>): Actor {
  const user = c.get("user");
  return { id: user?.id ?? 0, role: user?.role ?? "student" };
}

export const badCursor = (c: Context) =>
  c.json({ error: "invalid_request", message: "That page cursor is not valid." }, 400);

/** Parses a positive integer path parameter. */
export function paramId(c: Context, name = "id"): number | null {
  const n = Number(c.req.param(name));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
