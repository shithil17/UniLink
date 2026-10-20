import { notificationCopy } from "../shared/notificationCopy";
import { notificationType, type NotificationType } from "../shared/schemas/inbox";
import { pushMessage, type PushMessage } from "../shared/schemas/push";
import type { PushSender } from "./adapters/push";
import type { Db } from "./db/client";
import { limits } from "./limits";
import { notificationsRepo } from "./repos/notifications";
import { pushSubscriptionsRepo } from "./repos/pushSubscriptions";

export type NotifyOptions = {
  now?: number;
  /** When set, also pushes to the targets' subscribed devices. Best effort: a failure is ignored. */
  push?: PushSender | null;
};

/** The push for a type: words from the shared copy and a link to the inbox. Never payload values. */
export function pushMessageFor(type: NotificationType): PushMessage {
  const { title, detail } = notificationCopy(type);
  return pushMessage.parse({ title, body: detail, url: "/inbox" });
}

async function pushToTargets(db: Db, push: PushSender, userIds: number[], type: NotificationType) {
  const repo = pushSubscriptionsRepo(db);
  const devices = (await repo.listForUsers(userIds.slice(0, limits.pushFanoutMax))).slice(
    0,
    limits.pushFanoutMax,
  );
  const message = pushMessageFor(type);
  const results = await Promise.allSettled(devices.map((d) => push.send(d, message)));
  const gone = devices.flatMap((d, i) => {
    const r = results[i];
    return r?.status === "fulfilled" && !r.value.ok && r.value.gone ? [d.endpoint] : [];
  });
  await repo.removeEndpoints(gone);
}

/**
 * The single entry point for in-app notifications (Observer). Writes one row per distinct user,
 * batched, then (optionally) pushes to their devices. A payload must never name another user.
 * An empty list does nothing. The inbox rows are the source of truth: a push error never throws.
 */
export async function notify(
  db: Db,
  userIds: number[],
  type: NotificationType,
  payload: Record<string, unknown>,
  opts: NotifyOptions = {},
): Promise<void> {
  const valid = notificationType.parse(type);
  const targets = [...new Set(userIds)];
  if (targets.length === 0) return;
  const now = opts.now ?? Date.now();
  await notificationsRepo(db).insertMany(
    targets.map((userId) => ({ userId, type: valid, payload, createdAt: now })),
  );
  if (!opts.push) return;
  try {
    await pushToTargets(db, opts.push, targets, valid);
  } catch (err) {
    console.error("push failed", err instanceof Error ? err.name : "unknown");
  }
}
