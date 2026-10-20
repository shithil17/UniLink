import type { z } from "zod";
import type { modelStepResult } from "../../shared/schemas/moderation.ts";
import type { Db } from "../db/client";
import { limits } from "../limits";
import { rateLimit } from "../middleware/rateLimit";

export type ModelStepResult = z.infer<typeof modelStepResult>;

/**
 * What the model sees: the post text and any photos, nothing else. No username, no student ID, no
 * contact details, no grades. `images` are WebP bytes that already passed the image rules.
 */
export type ModelStepInput = { text: string; images: readonly Uint8Array[] };

/**
 * The second link in the screening chain. Phase 8 ships the stub; the Clef client replaces it with no
 * change to feature code. A step may throw or time out: `screen()` then holds the post for a moderator.
 */
export interface ModelStep {
  /** Written to the audit row so a decision can be traced to the model that made it. */
  readonly name: string;
  review(input: ModelStepInput, signal: AbortSignal): Promise<ModelStepResult>;
}

/** Thrown by a capped step once the day's quota is used up. `screen()` treats it as a hold, not an error. */
export class ModelCapReachedError extends Error {
  constructor() {
    super("The daily model call cap is used up");
    this.name = "ModelCapReachedError";
  }
}

/**
 * The Phase 8 stand-in. Text alone is approved. A post with photos goes to a moderator, so a photo is
 * never published unscreened while no real model can look at it.
 */
export class StubModelStep implements ModelStep {
  readonly name = "stub";

  async review(input: ModelStepInput): Promise<ModelStepResult> {
    const verdict = input.images.length > 0 ? "review" : "approve";
    return { verdict, category: "fine", confidence: null, scores: {} };
  }
}

/** A scripted step for tests: returns or throws what it is given and records every call. */
export class FakeModelStep implements ModelStep {
  readonly name: string;
  readonly calls: ModelStepInput[] = [];

  private readonly respond: (input: ModelStepInput, signal: AbortSignal) => Promise<unknown>;

  constructor(
    respond: (input: ModelStepInput, signal: AbortSignal) => Promise<unknown>,
    opts: { name?: string } = {},
  ) {
    this.respond = respond;
    this.name = opts.name ?? "fake";
  }

  async review(input: ModelStepInput, signal: AbortSignal): Promise<ModelStepResult> {
    this.calls.push(input);
    // Returned as is, not parsed: tests use this to hand `screen()` malformed model output.
    return (await this.respond(input, signal)) as ModelStepResult;
  }
}

/**
 * Wraps a step that costs quota (the Clef client; the stub is free and needs no cap). Counts every call against the daily cap through `rateLimit()` before it reaches the step. The window
 * is the UTC day, which is when the AI quota resets. Over the cap the step throws `ModelCapReachedError`.
 */
export function withDailyCap(step: ModelStep, db: Db, now: () => number = Date.now): ModelStep {
  return {
    name: step.name,
    async review(input, signal) {
      const result = await rateLimit(
        db,
        `model-cap:${step.name}`,
        limits.screen.modelDailyCap,
        limits.screen.modelCapWindowMs,
        now(),
      );
      if (!result.allowed) throw new ModelCapReachedError();
      return step.review(input, signal);
    },
  };
}
