import { CircleAlertIcon, ClockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/api";
import { useAppeal, type PostTargetType } from "@/lib/posts";
import { toast } from "@/lib/toast";
import { rejectReasonMessage } from "../../../shared/rejectReasons";
import type { reasonCategory } from "../../../shared/schemas/common";
import type { z } from "zod";

type Status = "published" | "pending_review" | "rejected";

/**
 * Where a post stands with the moderators, in words, wherever the author sees it. Nothing for a
 * published post. A held post says it is waiting for a moderator. A rejected one gives the
 * category-level reason (never what exactly was found) and, when `appeal` names the post, an "Ask a
 * moderator to look" button that sends it to the review queue. The icon is drawn and the state is
 * spelled out, so it never rests on color alone.
 */
export function StatusNote({
  status,
  what,
  category,
  appeal,
}: {
  status: Status;
  /** What the post is called in a sentence: "ride", "request", "link". */
  what: string;
  /** Why it was turned down, from the post's `rejectionCategory`. Without it the note says a moderator didn't approve it. */
  category?: z.infer<typeof reasonCategory> | null;
  /** The post, so the author can ask for a second look. Leave out where they can't. */
  appeal?: { targetType: PostTargetType; id: number };
}) {
  if (status === "published") return null;
  const held = status === "pending_review";
  const Icon = held ? ClockIcon : CircleAlertIcon;

  return (
    <div
      data-slot="status-note"
      className={`flex flex-col items-start gap-2 rounded-row px-3 py-2.5 text-[13px] leading-[1.4] text-ink ${held ? "bg-brand-soft" : "bg-danger-soft"}`}
    >
      <p className="flex items-start gap-2">
        <Icon
          aria-hidden
          strokeWidth={1.75}
          className={`mt-px size-[18px] shrink-0 ${held ? "text-brand-ink" : "text-danger"}`}
        />
        <span>
          {held
            ? `Waiting for a moderator. Your ${what} is shown to others once it is approved.`
            : `A moderator didn't approve this ${what}.${category ? ` ${rejectReasonMessage(category)}` : ""}`}
        </span>
      </p>
      {!held && appeal ? <AppealButton post={appeal} /> : null}
    </div>
  );
}

/** Its own component so a note that cannot appeal needs no query client. */
function AppealButton({ post }: { post: { targetType: PostTargetType; id: number } }) {
  const ask = useAppeal();
  const send = () =>
    ask.mutate(post, {
      onSuccess: () => toast.success("Sent. A moderator will take another look."),
      onError: (err) => toast.error(errorMessage(err)),
    });
  return (
    <Button variant="outline" size="sm" loading={ask.isPending} onClick={send}>
      Ask a moderator to look
    </Button>
  );
}
