import type { z } from "zod";
import type { postStatus } from "../../shared/schemas/common.ts";
import { modelStepResult } from "../../shared/schemas/moderation.ts";
import { ModelCapReachedError, type ModelStep } from "../adapters/modelStep";
import { limits } from "../limits";
import { runRules, type ReasonCategory, type RuleFlag, type RuleInput } from "./rules";

export type PostStatus = z.infer<typeof postStatus>;
export type Verdict = "approve" | "review" | "reject";

/** The text, photos and contacts of one post or edit. See `RuleInput`. Contacts are checked, never sent to the model. */
export type ScreenInput = RuleInput;

export type ScreenDeps = {
  model: ModelStep;
  /**
   * Test-only. Holds every post that passes the rules for review, so the mod queue can be exercised
   * before a real model exists. Set from the `SCREEN_FORCE_REVIEW` binding by `forceReviewFromEnv()`.
   */
  forceReview?: boolean;
  /** Overrides `limits.screen.modelTimeoutMs`. Tests only. */
  timeoutMs?: number;
};

/** Which link in the chain decided. `fail_safe` means the model step could not answer. */
export type ScreenSource = "rules" | "forced" | "model" | "fail_safe";

export type ScreenFailure = "error" | "timeout" | "cap";

export type ScreenOutcome = {
  verdict: Verdict;
  /** The status to store on the post. */
  status: PostStatus;
  category: ReasonCategory;
  source: ScreenSource;
  /** The rules that fired. Empty unless the source is `rules`. */
  flags: RuleFlag[];
  confidence: number | null;
  /** Per-category model scores. For the audit row only, never shown to the author. */
  scores: Record<string, number>;
  /** The model that judged it, or null when the rules decided alone. */
  modelName: string | null;
  failure: ScreenFailure | null;
  /** The screened text with IDs and card numbers blanked, cut to a length that fits an audit row. */
  snapshot: string;
};

const STATUS_FOR: Record<Verdict, PostStatus> = {
  approve: "published",
  review: "pending_review",
  reject: "rejected",
};

class ModelTimeoutError extends Error {}

/**
 * Reads the test-only forced-review switch. Only the exact value "1" turns it on, and it is unset in
 * every deployed environment by default. Set `SCREEN_FORCE_REVIEW=1` in `.dev.vars` (or as a staging
 * secret while exercising the queue) and remove it afterwards.
 */
export function forceReviewFromEnv(env: { SCREEN_FORCE_REVIEW?: string }): boolean {
  return env.SCREEN_FORCE_REVIEW === "1";
}

function outcome(
  verdict: Verdict,
  snapshot: string,
  rest: Pick<ScreenOutcome, "category" | "source"> & Partial<ScreenOutcome>,
): ScreenOutcome {
  return {
    verdict,
    status: STATUS_FOR[verdict],
    flags: [],
    confidence: null,
    scores: {},
    modelName: null,
    failure: null,
    snapshot,
    ...rest,
  };
}

async function askModel(model: ModelStep, input: ScreenInput, timeoutMs: number) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ModelTimeoutError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      model.review(
        { text: input.texts.join("\n\n"), images: input.images ?? [] },
        controller.signal,
      ),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The screening pipeline (Chain of Responsibility): rules, then the model step, then a verdict.
 * Every user-written post calls this on create and on any edit that changes screened text or photos.
 *
 * - A rule violation rejects at once and the model is never called.
 * - A model error, timeout, cap or malformed answer holds the post for a moderator. Unscreened text
 *   is never auto-published and never auto-rejected, but the rules above still apply.
 * - It decides only; `recordScreening()` writes the audit row once the post has an id.
 */
export async function screen(input: ScreenInput, deps: ScreenDeps): Promise<ScreenOutcome> {
  const rules = runRules(input);
  const snapshot = rules.redactedText.slice(0, limits.screen.snapshotMaxLength);

  if (rules.flags.length > 0) {
    return outcome("reject", snapshot, {
      category: rules.category,
      source: "rules",
      flags: rules.flags,
    });
  }
  if (deps.forceReview) {
    return outcome("review", snapshot, { category: "fine", source: "forced" });
  }

  const modelName = deps.model.name;
  const heldFor = (failure: ScreenFailure) =>
    outcome("review", snapshot, { category: "fine", source: "fail_safe", modelName, failure });

  let raw: unknown;
  try {
    raw = await askModel(deps.model, input, deps.timeoutMs ?? limits.screen.modelTimeoutMs);
  } catch (err) {
    if (err instanceof ModelTimeoutError) return heldFor("timeout");
    return heldFor(err instanceof ModelCapReachedError ? "cap" : "error");
  }

  // Model output is data: it must match the schema before it decides anything.
  const parsed = modelStepResult.safeParse(raw);
  if (!parsed.success) return heldFor("error");
  const { verdict, category, confidence, scores } = parsed.data;
  return outcome(verdict, snapshot, { category, source: "model", modelName, confidence, scores });
}

/** The moderation columns of a post row for this outcome, to spread into the insert or update. */
export function moderationValues(result: ScreenOutcome) {
  return {
    status: result.status,
    moderationCategory: result.category,
    moderationFlags: JSON.stringify(result.flags.map((f) => f.rule)),
    moderationConfidence: result.confidence,
    moderationModel: result.modelName,
    // A fresh screening supersedes any earlier "ask a moderator" tap.
    moderationAppealedAt: null,
  };
}
