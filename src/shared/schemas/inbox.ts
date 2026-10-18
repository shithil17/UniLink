import { z } from "zod";
import { id, instant } from "./common";

// Every notification type. A payload never carries another user's identity.
export const notificationType = z.enum([
  "post_approved",
  "post_rejected",
  "resource_requested",
  "resource_submitted",
  "resource_accepted",
  "lost_found_possible_match",
]);

export const notification = z.object({
  id,
  type: notificationType,
  payload: z.record(z.string(), z.unknown()),
  readAt: instant.nullable(),
  createdAt: instant,
});

export const unreadCount = z.object({ count: z.number().int().nonnegative() });
