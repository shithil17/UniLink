import { rejectReasonMessage } from "./rejectReasons";
import { reasonCategory } from "./schemas/common";
import type { NotificationType } from "./schemas/inbox";

// Shared by the inbox screen and web push, so a notification reads the same everywhere.

export type NotificationCopy = { title: string; detail: string };

const COPY: Record<NotificationType, NotificationCopy> = {
  post_approved: {
    title: "Your post is live",
    detail: "A moderator approved it, so other students can see it now.",
  },
  post_rejected: {
    title: "Your post wasn't approved",
    detail: "A moderator held it back. You can edit it and send it again.",
  },
  resource_requested: {
    title: "A student is looking for a resource",
    detail: "It matches a course you have taken. Have a look and share a link if you can help.",
  },
  resource_submitted: {
    title: "Someone sent a link for your request",
    detail: "Open your request to accept it or turn it down.",
  },
  resource_accepted: {
    title: "Your link was accepted",
    detail: "The student who asked found it useful.",
  },
  lost_found_possible_match: {
    title: "A found post may match your lost item",
    detail: "Someone posted something similar. Check whether it's yours.",
  },
  push_test: {
    title: "Test notification",
    detail: "Notifications reach this device. Nothing else to do.",
  },
};

/**
 * Words for a notification, built here from its type. Free text from a payload is never shown. The one
 * payload value that changes the words is a rejection's `category`, and only after it parses as one of
 * the known categories; the sentence itself comes from `rejectReasonMessage`.
 */
export function notificationCopy(
  type: NotificationType,
  payload?: Record<string, unknown>,
): NotificationCopy {
  if (type === "post_rejected") {
    const category = reasonCategory.safeParse(payload?.category);
    if (category.success) {
      return { title: COPY[type].title, detail: rejectReasonMessage(category.data) };
    }
  }
  return COPY[type];
}
