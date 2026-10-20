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
  // An admin checking that web push reaches their own devices.
  "push_test",
]);

export type NotificationType = z.infer<typeof notificationType>;

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
