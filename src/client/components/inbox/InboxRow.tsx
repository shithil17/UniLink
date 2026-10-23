import {
  BellIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  HandHelpingIcon,
  LinkIcon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { focusRingInset } from "@/components/ui/focus";
import { notificationCopy, notificationHue, timeAgo } from "@/lib/inbox";
import type { Notification, NotificationType } from "../../../shared/schemas/inbox";

/** One drawn icon per kind; the hue behind it comes from `notificationHue`. */
const ICON: Record<NotificationType, LucideIcon> = {
  post_approved: CircleCheckIcon,
  post_rejected: CircleAlertIcon,
  resource_requested: HandHelpingIcon,
  resource_submitted: LinkIcon,
  resource_accepted: CircleCheckIcon,
  lost_found_possible_match: SearchIcon,
  push_test: BellIcon,
};

const rowBase = "flex w-full items-start gap-3 px-4 py-3.5 text-left";

/**
 * A notification row: a 40px circle tinted by kind, a 15px title (500, 700 while unread), a body
 * clamped to two lines in `soft`, and the time at the right. Unread also shows a "New" badge so
 * the state is a word as well as a weight. Only an unread row is a control (opening it marks it
 * read). `now` is the instant ages are measured from, so rendering stays pure.
 */
export function InboxRow({ n, now, onOpen }: { n: Notification; now: number; onOpen: () => void }) {
  const { title, detail } = notificationCopy(n.type, n.payload);
  const unread = n.readAt === null;
  const Icon = ICON[n.type];

  const body = (
    <>
      <span
        data-slot="inbox-icon"
        data-hue={notificationHue(n.type)}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-hue text-hue-ink"
      >
        <Icon aria-hidden strokeWidth={1.75} className="size-5" />
      </span>
      <span className="grid min-w-0 flex-1 gap-[3px]">
        <span
          data-slot="inbox-title"
          className={`text-[15px] leading-[1.3] text-ink ${unread ? "font-bold" : "font-medium"}`}
        >
          {title}
          {unread ? <span className="sr-only"> (unread)</span> : null}
        </span>
        <span className="line-clamp-2 text-[13px] leading-[1.4] text-soft">{detail}</span>
      </span>
      <span className="grid shrink-0 justify-items-end gap-1.5">
        <time
          dateTime={new Date(n.createdAt).toISOString()}
          className="text-xs leading-[1.3] whitespace-nowrap text-faint tabular-nums"
        >
          {timeAgo(n.createdAt, now)}
        </time>
        {unread ? (
          <Badge variant="soft" aria-hidden>
            New
          </Badge>
        ) : null}
      </span>
    </>
  );

  return unread ? (
    <button
      type="button"
      onClick={onOpen}
      className={`${rowBase} min-h-[60px] hover:bg-tint ${focusRingInset}`}
    >
      {body}
    </button>
  ) : (
    <div className={`${rowBase} min-h-[60px]`}>{body}</div>
  );
}
