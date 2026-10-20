import type { Notification } from "../../shared/schemas/inbox";

// ceiling: the nav badge reads "9+" past this count so it never outgrows the tab. Revisit if
// students ask for exact counts.
export const INBOX_BADGE_MAX = 9;

// ceiling: the unread count refreshes on window focus and on this interval while the app is open.
// Each poll is one indexed count on the server. Revisit if D1 reads climb or students want it live.
export const INBOX_POLL_MS = 60_000;

/** The badge text: the count, or "9+" past the cap. Empty at zero (the badge is hidden). */
export function badgeLabel(count: number): string {
  if (count <= 0) return "";
  return count > INBOX_BADGE_MAX ? `${INBOX_BADGE_MAX}+` : String(count);
}

export type NotificationCopy = { title: string; detail: string };

const COPY: Record<Notification["type"], NotificationCopy> = {
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
};

/** Words for a notification, built here from its type. Free text from a payload is never shown. */
export function notificationCopy(type: Notification["type"]): NotificationCopy {
  return COPY[type];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Dhaka",
});

/** "Just now", "5 min ago", "3 h ago", "2 d ago", then a day and month (Asia/Dhaka). */
export function timeAgo(at: number, now: number): string {
  const diff = Math.max(0, now - at);
  if (diff < MINUTE) return "Just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)} d ago`;
  return dateFormat.format(at);
}
