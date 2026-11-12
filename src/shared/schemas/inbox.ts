import { z } from "zod";
import { id, instant, page } from "./common";

// Every notification type. A payload never carries another user's identity.
export const notificationType = z.enum([
  "post_approved",
  "post_rejected",
  "resource_requested",
  "resource_submitted",
  "resource_accepted",
  "lost_found_possible_match",
  // A moderator removed something the user posted. The payload is `{ kind, reason }` only.
  "content_removed",
  // An admin checking that web push reaches their own devices.
  "push_test",
]);

export type NotificationType = z.infer<typeof notificationType>;

/**
 * The content a moderator can remove, by the audit target type `softDelete()` writes. A test keeps
 * this in step with `softDeleteTargets`.
 */
export const removedContentKind = z.enum(["resource_request", "resource_submission"]);

export type RemovedContentKind = z.infer<typeof removedContentKind>;

export const notification = z.object({
  id,
  type: notificationType,
  payload: z.record(z.string(), z.unknown()),
  readAt: instant.nullable(),
  createdAt: instant,
});

export type Notification = z.infer<typeof notification>;

export const notificationPage = page(notification);

export const unreadCount = z.object({ count: z.number().int().nonnegative() });

/** The answer to "mark all read": how many notifications that changed. */
export const readAllResult = z.object({ updated: z.number().int().nonnegative() });
