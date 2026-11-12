import type { Db } from "../db/client";
import { StubModelStep, type ModelStep } from "../adapters/modelStep";
import type { SessionUser } from "../middleware/types";
import { mayPost, recordRejection, type MayPost } from "./probing";
import { recordScreening } from "./record";
import {
  forceReviewFromEnv,
  moderationValues,
  screen,
  type PostStatus,
  type ScreenInput,
  type ScreenOutcome,
} from "./screen";

export type SubmitArgs = {
  user: Pick<SessionUser, "id" | "createdAt">;
  /** The post type, as keyed in the moderated post registry. It is the audit row's target type. */
  targetType: string;
  input: ScreenInput;
  /**
   * On an edit: the status the post had before it. A post that was not published (held, or rejected by
   * a moderator or the screen) never goes live because an edit passed the screen: a passing result is
   * saved as `pending_review`, so it stays in the moderators' queue. A rejection stays a rejection.
   * Leave it out on create.
   */
  previousStatus?: PostStatus;
  /**
   * Writes the post: an insert on create, an update on an edit that changes screened text. It must
   * spread `values` into the row, and return the post's id. It runs only when posting is allowed.
   */
  save: (values: ReturnType<typeof moderationValues>) => Promise<number>;
};

export type SubmitResult =
  | Extract<MayPost, { ok: false }>
  | {
      ok: true;
      id: number;
      outcome: ScreenOutcome;
      /** True when this automatic rejection started the posting cooldown. */
      cooldownStarted: boolean;
    };

/**
 * The one sequence every user-written post runs on create and on every edit that changes screened
 * text: may this user post, screen the text, save the row with the result, log the automatic decision,
 * and count an automatic rejection towards the probing cooldown. A post type calls this instead of
 * wiring the steps itself, so none of them can be skipped.
 *
 * On `ok: false` nothing was screened or saved; answer 429 with `retryAfterMs`.
 */
export async function submitPost(
  db: Db,
  env: { SCREEN_FORCE_REVIEW?: string },
  args: SubmitArgs,
  opts: { model?: ModelStep; now?: number } = {},
): Promise<SubmitResult> {
  const now = opts.now ?? Date.now();
  const allowed = await mayPost(db, args.user, now);
  if (!allowed.ok) return allowed;

  const screened = await screen(args.input, {
    model: opts.model ?? new StubModelStep(),
    forceReview: forceReviewFromEnv(env),
  });
  // The saved row and the audit row both carry the held outcome, so they agree.
  const outcome: ScreenOutcome =
    screened.verdict === "approve" && args.previousStatus && args.previousStatus !== "published"
      ? { ...screened, verdict: "review", status: "pending_review", source: "unpublished_edit" }
      : screened;
  const id = await args.save(moderationValues(outcome));
  await recordScreening(db, outcome, { type: args.targetType, id }, now);
  const cooldownStarted =
    outcome.verdict === "reject" ? await recordRejection(db, args.user.id, now) : false;
  return { ok: true, id, outcome, cooldownStarted };
}
