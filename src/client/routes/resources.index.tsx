import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { HandHelpingIcon, InfoIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { MyRequestPanel } from "@/components/resources/MyRequestPanel";
import { ReportSheet, type ReportTarget } from "@/components/resources/ReportSheet";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { meQuery } from "@/lib/queries";
import { acceptLinkConfirm, myRequestsQuery, purgeNotice, useDecideLink } from "@/lib/resources";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/lib/useConfirm";

export const Route = createFileRoute("/resources/")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: MyRequests,
});

const panel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";

function MyRequests() {
  const list = useInfiniteQuery(myRequestsQuery);
  const accept = useDecideLink("accept");
  const reject = useDecideLink("reject");
  const { ask, element } = useConfirm();
  const [report, setReport] = useState<ReportTarget | null>(null);

  const requests = list.data?.pages.flatMap((p) => p.items) ?? [];
  const now = list.dataUpdatedAt;
  const notice = purgeNotice();
  const busy = accept.isPending || reject.isPending;

  return (
    <div className="max-w-2xl space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
            My requests
          </h1>
          <p className="mt-1 text-soft">Ask for notes, slides or past papers.</p>
        </div>
        <Link to="/resources/new" className={buttonVariants({ size: "sm", className: "shrink-0" })}>
          <PlusIcon aria-hidden strokeWidth={1.75} />
          New request
        </Link>
      </header>

      <p className="flex items-start gap-2 text-[13px] leading-[1.4] text-soft">
        <InfoIcon
          aria-hidden
          strokeWidth={1.75}
          className="mt-px size-[18px] shrink-0 text-faint"
        />
        <span>
          {notice.open} {notice.fulfilled}
        </span>
      </p>

      {list.isPending ? (
        <div role="status" aria-label="Loading your requests" className={`${panel} grid gap-3 p-4`}>
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      ) : list.isError ? (
        <ErrorBlock
          title="Your requests didn't load"
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : requests.length === 0 ? (
        <div className={panel}>
          <EmptyState
            icon={HandHelpingIcon}
            title="No requests yet."
            description="Ask for a course's notes and students who took it are told."
            action={
              <Link to="/resources/new" className={buttonVariants({ size: "sm" })}>
                New request
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {requests.map((r) => (
              <MyRequestPanel
                key={r.id}
                request={r}
                now={now}
                busy={busy}
                onReport={setReport}
                onAccept={(link) =>
                  ask(
                    acceptLinkConfirm(link.uploader, async () => {
                      await accept.mutateAsync(link.id);
                      toast.success("Link accepted. Thanks for closing the loop.");
                    }),
                  )
                }
                onReject={(link) =>
                  reject.mutate(link.id, {
                    onSuccess: () => toast.success("Link turned down"),
                    onError: (err) => toast.error(errorMessage(err)),
                  })
                }
              />
            ))}
          </div>
          {list.hasNextPage ? (
            <Button
              variant="outline"
              className="w-full"
              loading={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Show older
            </Button>
          ) : null}
        </>
      )}
      {element}
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </div>
  );
}
