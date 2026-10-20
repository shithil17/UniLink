import { auditActions } from "../../../shared/auditActions";
import type { rejectCategory } from "../../../shared/schemas/moderation";
import type { z } from "zod";
import type { PushSender } from "../../adapters/push";
import { audit } from "../../audit";
import type { Db } from "../../db/client";
import {
  moderatedPostTypes,
  postTypeOf,
  type ModeratedPostTypes,
} from "../../moderation/postTypes";
import { notify } from "../../notify";
import { moderatedPostsRepo } from "../../repos/moderatedPosts";
import type { Actor } from "./actions";

export type PostDecisionFailure = "unknown_target" | "not_found" | "not_held";

export type PostDecisionResult = { ok: true } | { ok: false; reason: PostDecisionFailure };

export type PostDecision =
  | { decision: "approve"; reason?: string }
  | { decision: "reject"; reason: string; category: z.infer<typeof rejectCategory> };

/**
 * A mod's decision on a held post. It overrides whatever the model said: the status is set, an audit
 * row keeps the before-snapshot (status and the model's category, confidence and rule flags) and the
 * reason, and the author is told through `notify()` either way. A rejection carries a category, which
 * the author sees as a category-level message, never the mod's reason.
 *
 * Not reversible by an admin: the author has already been told, so the way back is the author editing
 * and resubmitting, or a mod deciding again after the post is sent back to the queue.
 */
export async function decidePost(
  db: Db,
  actor: Actor,
  target: { type: string; id: number },
  decision: PostDecision,
  opts: { postTypes?: ModeratedPostTypes; push?: PushSender | null; now?: number } = {},
): Promise<PostDecisionResult> {
  const type = postTypeOf(opts.postTypes ?? moderatedPostTypes, target.type);
  if (!type) return { ok: false, reason: "unknown_target" };
  const now = opts.now ?? Date.now();

  const repo = moderatedPostsRepo(db, type.table);
  const before = await repo.find(target.id);
  if (!before || before.deletedAt !== null) return { ok: false, reason: "not_found" };
  const approve = decision.decision === "approve";
  const changed = await repo.decide(
    target.id,
    approve ? "published" : "rejected",
    approve ? null : decision.category,
  );
  // The UPDATE is guarded on the post still being held, so two mods racing decide it once.
  if (!changed) return { ok: false, reason: "not_held" };

  await audit(
    db,
    {
      actor: actor.id,
      action: approve ? auditActions.modApprovePost : auditActions.modRejectPost,
      targetType: target.type,
      targetId: target.id,
      before: {
        status: before.status,
        category: before.category,
        confidence: before.confidence,
        flags: before.flags,
        model: before.model,
      },
      reason: decision.reason,
    },
    now,
  );
  await notify(
    db,
    [before.authorId],
    approve ? "post_approved" : "post_rejected",
    approve
      ? { targetType: target.type, targetId: target.id }
      : { targetType: target.type, targetId: target.id, category: decision.category },
    { now, push: opts.push },
  );
  return { ok: true };
}
