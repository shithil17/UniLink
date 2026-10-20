import type { Db } from "../db/client";
import { StubModelStep, type ModelStep } from "../adapters/modelStep";
import type { SessionUser } from "../middleware/types";
import { mayPost, recordRejection, type MayPost } from "./probing";
import { recordScreening } from "./record";
import {
  forceReviewFromEnv,
  moderationValues,
  screen,
  type ScreenInput,
  type ScreenOutcome,
} from "./screen";

export type SubmitArgs = {
  user: Pick<SessionUser, "id" | "createdAt">;
  /** The post type, as keyed in the moderated post registry. It is the audit row's target type. */
  targetType: string;
  input: ScreenInput;
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

  const outcome = await screen(args.input, {
    model: opts.model ?? new StubModelStep(),
    forceReview: forceReviewFromEnv(env),
  });
  const id = await args.save(moderationValues(outcome));
  await recordScreening(db, outcome, { type: args.targetType, id }, now);
  const cooldownStarted =
    outcome.verdict === "reject" ? await recordRejection(db, args.user.id, now) : false;
  return { ok: true, id, outcome, cooldownStarted };
}
