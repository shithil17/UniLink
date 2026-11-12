import { CircleCheckIcon, ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { expiryLine, linkHost, safeLink } from "@/lib/resources";
import { timeAgo } from "@/lib/inbox";
import type {
  MyResourceRequest,
  ResourceSubmissionForRequester,
} from "../../../shared/schemas/resources";
import { StatusNote } from "@/components/posts/StatusNote";
import { RequestHeading } from "./RequestHeading";

const STATE_BADGE: Record<
  MyResourceRequest["state"],
  { label: string; variant: "soft" | "outline" }
> = {
  open: { label: "Open", variant: "soft" },
  fulfilled: { label: "Fulfilled", variant: "outline" },
  expired: { label: "Expired", variant: "outline" },
};

/**
 * One of the student's own requests as a flat panel: what it asks for and when it goes away, then a
 * row for each link sent to it. This is the only place a link and its sender's username appear.
 * Accepting is a button here; the page asks "are you sure" first (it closes the request).
 */
export function MyRequestPanel({
  request,
  now,
  onAccept,
  onReject,
  onReport,
  busy,
}: {
  request: MyResourceRequest;
  now: number;
  onAccept: (link: ResourceSubmissionForRequester) => void;
  onReject: (link: ResourceSubmissionForRequester) => void;
  onReport: (target: { type: "resource_request" | "resource_submission"; id: number }) => void;
  busy: boolean;
}) {
  const badge = STATE_BADGE[request.state];
  const deciding = request.state === "open";
  return (
    <section
      aria-label={`Request for ${request.courseCode ?? request.faculty?.name ?? "materials"}`}
      className="overflow-hidden rounded-panel bg-surface md:rounded-[24px]"
    >
      <div className="grid gap-2 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <RequestHeading request={request} />
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        {request.note ? (
          <p className="text-[15px] leading-[1.4] break-words text-ink">{request.note}</p>
        ) : null}
        <p className="text-[13px] leading-[1.4] text-soft">{expiryLine(request, now)}</p>
        <StatusNote
          status={request.status}
          what="request"
          category={request.rejectionCategory}
          appeal={{ targetType: "resource_request", id: request.id }}
        />
      </div>
      {request.submissions.length === 0 ? (
        <p className="border-t border-line px-4 py-3.5 text-[13px] leading-[1.4] text-soft">
          {request.status === "published" && request.state === "open"
            ? "No links yet. You'll get a notification when one arrives."
            : "No links were sent."}
        </p>
      ) : (
        <ul>
          {request.submissions.map((link) => {
            const href = safeLink(link.url);
            return (
              <li key={link.id} className="grid gap-2 border-t border-line px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-[15px] font-medium text-ink">
                      {link.uploader}
                    </span>
                    {link.sameFaculty === null ? null : (
                      <span className="text-[13px] leading-[1.3] text-soft">
                        {link.sameFaculty
                          ? "Took it with the same faculty"
                          : "Different faculty, or not recorded"}
                      </span>
                    )}
                  </span>
                  <time
                    dateTime={new Date(link.createdAt).toISOString()}
                    className="shrink-0 text-xs text-faint tabular-nums"
                  >
                    {timeAgo(link.createdAt, now)}
                  </time>
                </div>
                {link.note ? (
                  <p className="text-[13px] leading-[1.4] break-words text-soft">{link.note}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <ExternalLinkIcon aria-hidden />
                      Open on {linkHost(link.url)}
                    </a>
                  ) : null}
                  {link.decision === "accepted" ? (
                    <Badge variant="soft">
                      <CircleCheckIcon aria-hidden />
                      Accepted
                    </Badge>
                  ) : link.decision === "rejected" ? (
                    <Badge>Turned down</Badge>
                  ) : deciding ? (
                    <>
                      <Button size="sm" disabled={busy} onClick={() => onAccept(link)}>
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => onReject(link)}
                      >
                        Turn down
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onReport({ type: "resource_submission", id: link.id })}
                  >
                    Report
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
