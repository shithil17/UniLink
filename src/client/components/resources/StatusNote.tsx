import { CircleAlertIcon, ClockIcon } from "lucide-react";

type Status = "published" | "pending_review" | "rejected";

/**
 * Where a post stands with the moderators, in words, wherever the author sees it. Nothing for a
 * published post. The icon is drawn and the state is spelled out, so it never rests on color alone.
 */
export function StatusNote({ status, what }: { status: Status; what: string }) {
  if (status === "published") return null;
  const held = status === "pending_review";
  const Icon = held ? ClockIcon : CircleAlertIcon;
  return (
    <p
      data-slot="status-note"
      className={`flex items-start gap-2 rounded-row px-3 py-2.5 text-[13px] leading-[1.4] text-ink ${held ? "bg-brand-soft" : "bg-danger-soft"}`}
    >
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className={`mt-px size-[18px] shrink-0 ${held ? "text-brand-ink" : "text-danger"}`}
      />
      {held
        ? `Waiting for a moderator. Your ${what} is shown to others once it is approved.`
        : `A moderator didn't approve this ${what}.`}
    </p>
  );
}
