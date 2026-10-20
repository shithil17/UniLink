import { notificationType, type NotificationType } from "../shared/schemas/inbox";
import type { Db } from "./db/client";
import { notificationsRepo } from "./repos/notifications";

/**
 * The single entry point for in-app notifications (Observer). Writes one row per distinct user,
 * batched. A payload must never name another user. An empty list does nothing.
 */
export async function notify(
  db: Db,
  userIds: number[],
  type: NotificationType,
  payload: Record<string, unknown>,
  now: number = Date.now(),
): Promise<void> {
  const valid = notificationType.parse(type);
  const targets = [...new Set(userIds)];
  if (targets.length === 0) return;
  await notificationsRepo(db).insertMany(
    targets.map((userId) => ({ userId, type: valid, payload, createdAt: now })),
  );
}
