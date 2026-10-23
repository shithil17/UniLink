import type { NotificationType } from "../../shared/schemas/inbox";
import type { Hue } from "./courseHue";

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

// The words for each notification type live in shared code so web push uses the same text.
export { notificationCopy, type NotificationCopy } from "../../shared/notificationCopy";

/**
 * The course hue that tints each notification kind's icon: good news (live, accepted) is mint, bad
 * news rose, a request sky, a submitted link lilac, a possible lost-and-found match butter. The
 * admin's test push has no meaning of its own and takes the neutral default, sky. A `Record` over
 * every kind, so a new kind without a hue fails the type check.
 */
export const NOTIFICATION_HUE: Record<NotificationType, Hue> = {
  post_approved: "mint",
  post_rejected: "rose",
  resource_requested: "sky",
  resource_submitted: "lilac",
  resource_accepted: "mint",
  lost_found_possible_match: "butter",
  push_test: "sky",
};

/** The hue for a notification kind's icon tint. */
export function notificationHue(type: NotificationType): Hue {
  return NOTIFICATION_HUE[type];
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
