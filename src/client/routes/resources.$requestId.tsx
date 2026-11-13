import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate, redirect } from "@tanstack/react-router";
import { CircleCheckIcon, ClockIcon, LockKeyholeIcon } from "lucide-react";
import { RequestHeading } from "@/components/resources/RequestHeading";
import { ReportButton } from "@/components/posts/ReportButton";
import { StatusNote } from "@/components/posts/StatusNote";
import { SubmitForm } from "@/components/resources/SubmitForm";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/inbox";
import { meQuery } from "@/lib/queries";
import {
  expiryLine,
  linkHost,
  requestDetailQuery,
  REQUEST_REPORT_DESCRIPTION,
} from "@/lib/resources";
import type { ResourceRequestDetail } from "../../shared/schemas/resources";

export const Route = createFileRoute("/resources/$requestId")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: SubmitScreen,
});

const panel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";

function SubmitScreen() {
  const raw = Route.useParams().requestId;
  const id = /^\d+$/.test(raw) ? Number(raw) : 0;
  const detail = useQuery({ ...requestDetailQuery(id), enabled: id > 0 });

  const gone = id === 0 || (detail.error instanceof ApiError && detail.error.status === 404);

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
        Help with a request
      </h1>
      {gone ? (
        <div className={panel}>
          <EmptyState
            icon={LockKeyholeIcon}
            title="This request is closed."
            description="It was fulfilled, it expired or it was removed. Thanks for looking."
            action={
              <Link to="/inbox" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Back to inbox
              </Link>
            }
          />
        </div>
      ) : detail.isPending ? (
        <div role="status" aria-label="Loading the request" className={`${panel} grid gap-3 p-4`}>
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : detail.isError ? (
        <ErrorBlock
          title="The request didn't load"
          message={errorMessage(detail.error)}
          onRetry={() => void detail.refetch()}
          retrying={detail.isRefetching}
        />
      ) : detail.data.mine ? (
        // Your own request has nothing to send to: its links are on My requests.
        <Navigate to="/resources" replace />
      ) : (
        <>
          <RequestSummary request={detail.data} now={detail.dataUpdatedAt} />
          <p className="flex items-start gap-2 text-[13px] leading-[1.4] text-soft">
            <LockKeyholeIcon
              aria-hidden
              strokeWidth={1.75}
              className="mt-px size-[18px] shrink-0 text-faint"
            />
            Only the student who asked can open your link, and they see your username next to it.
          </p>
          <div className="rounded-panel bg-surface p-4 md:rounded-[24px] md:p-5">
            <SubmitForm requestId={id} />
          </div>
          <MySubmissions links={detail.data.mySubmissions} now={detail.dataUpdatedAt} />
          <ReportButton
            type="resource_request"
            id={id}
            label="Report this request"
            description={REQUEST_REPORT_DESCRIPTION}
          />
        </>
      )}
    </div>
  );
}

function RequestSummary({ request, now }: { request: ResourceRequestDetail; now: number }) {
  return (
    <section aria-label="The request" className={`${panel} grid gap-2 px-4 py-3.5`}>
      <RequestHeading request={request} />
      {request.note ? (
        <p className="text-[15px] leading-[1.4] break-words text-ink">{request.note}</p>
      ) : null}
      <p className="text-[13px] leading-[1.4] text-soft">{expiryLine(request, now)}</p>
    </section>
  );
}

const OWN_STATUS: Record<
  ResourceRequestDetail["mySubmissions"][number]["decision"],
  { label: string; Icon: typeof ClockIcon } | null
> = {
  open: { label: "Sent", Icon: ClockIcon },
  accepted: { label: "Accepted", Icon: CircleCheckIcon },
  rejected: { label: "Turned down", Icon: ClockIcon },
};

/** The links this student already sent here, and where each stands. Never anyone else's. */
function MySubmissions({
  links,
  now,
}: {
  links: ResourceRequestDetail["mySubmissions"];
  now: number;
}) {
  if (links.length === 0) return null;
  return (
    <section aria-labelledby="my-links-title">
      <h2 id="my-links-title" className="pb-3 text-lg leading-[1.3] font-semibold text-ink">
        Your links
      </h2>
      <ul className={panel}>
        {links.map((link) => {
          const status = OWN_STATUS[link.decision];
          return (
            <li
              key={link.id}
              className="grid gap-2 border-t border-line px-4 py-3 first:border-t-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] font-medium text-ink">
                  {linkHost(link.url) || "Link"}
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
              {status ? (
                <div>
                  <Badge variant={link.decision === "accepted" ? "soft" : "outline"}>
                    {status.label}
                  </Badge>
                </div>
              ) : null}
              <StatusNote
                status={link.status}
                what="link"
                category={link.rejectionCategory}
                appeal={{ targetType: "resource_submission", id: link.id }}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
