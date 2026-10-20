import type { z } from "zod";
import type { reasonCategory } from "./schemas/common";

export type ReasonCategory = z.infer<typeof reasonCategory>;

/*
 * The author-facing copy from `docs/reject-reasons.md`. Change both together: the keys, the
 * category-level rule and the callers stay.
 *
 * Category-level only. A message never names a score, a rule, a banned word or what exactly was found,
 * because that would tell someone how to get around the screen.
 */
const MESSAGES: Record<ReasonCategory, string> = {
  prohibited_item:
    "This post looks like it's about something that can't be posted on UniLink. You can edit it and send it again.",
  personal_data:
    "This post seems to include personal details, like an ID or a card number. Take those out and send it again.",
  scam_or_spam:
    "This post looks like it could be spam or a scam. If that's not what it is, edit it and send it again.",
  abuse_or_harassment:
    "This post has wording that could hurt or harass someone. You can change it and send it again.",
  off_topic: "This post doesn't seem to fit here. You can edit it and send it again.",
  fine: "A moderator looked at this post and decided it can't go up as written. You can edit it and send it again.",
};

/** The author-facing message for a rejection in this category. */
export function rejectReasonMessage(category: ReasonCategory): string {
  return MESSAGES[category];
}

/** Every category's message, for tests that check none is empty or leaks detail. */
export const rejectReasonMessages: Readonly<Record<ReasonCategory, string>> = MESSAGES;
