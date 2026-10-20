import { auditActions } from "../../shared/auditActions";
import { audit } from "../audit";
import type { Db } from "../db/client";
import type { ScreenOutcome, Verdict } from "./screen";

const ACTION_FOR: Record<Verdict, string> = {
  approve: auditActions.automodApprove,
  review: auditActions.automodHold,
  reject: auditActions.automodReject,
};

/**
 * Writes the audit row for an automatic decision: actor `automod`, the model name, the category, the
 * scores and a text snapshot. Call it once the post has an id. `AuditEntry` has one JSON slot, `before`,
 * so the decision detail goes there; automod actions are not reversible, so nothing reads it back as a
 * restore snapshot.
 */
export async function recordScreening(
  db: Db,
  result: ScreenOutcome,
  target: { type: string; id: number | string },
  now: number = Date.now(),
): Promise<void> {
  await audit(
    db,
    {
      actor: "automod",
      action: ACTION_FOR[result.verdict],
      targetType: target.type,
      targetId: target.id,
      before: {
        text: result.snapshot,
        model: result.modelName,
        category: result.category,
        source: result.source,
        confidence: result.confidence,
        scores: result.scores,
        rules: result.flags,
        failure: result.failure,
      },
      reason: `${result.category} (${result.source})`,
    },
    now,
  );
}
