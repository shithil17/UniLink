import { rejectReasonMessage } from "./rejectReasons";
import { reasonCategory } from "./schemas/common";
import { reasonText } from "./schemas/moderation";
import {
  removedContentKind,
  type NotificationType,
  type RemovedContentKind,
} from "./schemas/inbox";

// Shared by the inbox screen and web push, so a notification reads the same everywhere.

export type NotificationCopy = { title: string; detail: string };

const COPY: Record<NotificationType, NotificationCopy> = {
  post_approved: {
    title: "Your post is live",
    detail: "A moderator approved it, so other students can see it now.",
  },
  post_rejected: {
    title: "Your post wasn't approved",
    detail: "A moderator reviewed it and decided it can't go up.",
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
  // The base words are what a push shows on a lock screen: no kind, no reason.
  content_removed: {
    title: "A moderator removed something you posted",
    detail: "Open your inbox to see what and why.",
  },
  push_test: {
    title: "Test notification",
    detail: "Notifications reach this device. Nothing else to do.",
  },
};

// An approved request is public; an approved link is only ever visible to the student who asked.
const APPROVED: Record<RemovedContentKind, NotificationCopy> = {
  resource_request: COPY.post_approved,
  resource_submission: {
    title: "Your link was approved",
    detail: "A moderator approved it, so the student who asked can see it now.",
  },
  ride: {
    title: "Your ride is live",
    detail: "A moderator approved it, so other students can see it now.",
  },
};

const REMOVED_TITLE: Record<RemovedContentKind, string> = {
  resource_request: "A moderator removed your request for materials",
  resource_submission: "A moderator removed a link you sent to a request",
  ride: "A moderator removed your ride",
};

/**
 * Words for a notification, built here from its type. Free text from a payload is never shown, with
 * one exception: a removal's `reason`, which a moderator wrote and which must parse as a valid mod
 * reason. Otherwise a payload value only picks among fixed words: a rejection's `category` (after it
 * parses as a known category; the sentence comes from `rejectReasonMessage`) and a removal's `kind`.
 */
export function notificationCopy(
  type: NotificationType,
  payload?: Record<string, unknown>,
): NotificationCopy {
  if (type === "post_approved") {
    const kind = removedContentKind.safeParse(payload?.targetType);
    if (kind.success) {
      return APPROVED[kind.data];
    }
  }
  if (type === "post_rejected") {
    const category = reasonCategory.safeParse(payload?.category);
    if (category.success) {
      return { title: COPY[type].title, detail: rejectReasonMessage(category.data) };
    }
  }
  if (type === "content_removed") {
    const kind = removedContentKind.safeParse(payload?.kind);
    const reason = reasonText.safeParse(payload?.reason);
    return {
      title: kind.success ? REMOVED_TITLE[kind.data] : COPY[type].title,
      detail: reason.success ? `Reason: ${reason.data}` : "It was taken down by a moderator.",
    };
  }
  return COPY[type];
}
