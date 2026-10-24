import { useInfiniteQuery, type UseInfiniteQueryResult } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { InboxIcon } from "lucide-react";
import { modPanel as panel, modRowLine, modTitle } from "@/components/mod/modStyles";
import { PostRow, ReportRow } from "@/components/mod/QueueRows";
import { RejectPostSheet } from "@/components/mod/RejectPostSheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api";
import { modQueueList, modReportsList, useDecidePost } from "@/lib/mod";
import { toast } from "@/lib/toast";
import type { ModQueuePost, ModReport } from "../../shared/schemas/moderation";

export const Route = createFileRoute("/mod/queue")({
  component: QueuePage,
});

/** The loading row in the final layout: author and kind on one line, then two lines of text. */
const skeletonRow = (
  <div className="grid min-w-0 flex-1 gap-2 py-1">
    <Skeleton className="h-4 w-1/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-2/3" />
  </div>
);

type View = "queue" | Exclude<ModReport["status"], "open">;

function QueuePage() {
  const [view, setView] = useState<View>("queue");
  return (
    <section className="space-y-4">
      <h1 className={modTitle}>Review queue</h1>
      <Tabs value={view} onValueChange={(value) => setView(value as View)}>
        <TabsList aria-label="Queue view" className="w-full md:w-80">
          <TabsTrigger value="queue">Waiting</TabsTrigger>
          <TabsTrigger value="resolved">Handled</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>
      </Tabs>
      {view === "queue" ? <WaitingList /> : <HistoryList status={view} />}
    </section>
  );
}

/** Held posts and open reports in one list, with the size of the whole queue above it. */
function WaitingList() {
  const list = useInfiniteQuery(modQueueList);
  const decide = useDecidePost();
  const [rejecting, setRejecting] = useState<ModQueuePost | null>(null);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = list.data?.pages[0]?.total;
  const now = list.dataUpdatedAt;

  return (
    <>
      {total === undefined ? null : (
        <p className="text-soft tabular-nums" aria-live="polite">
          <span className="font-semibold text-ink">{total}</span> waiting for a moderator
        </p>
      )}
      <ListShell list={list} label="queue" empty="Nothing is waiting for you." count={items.length}>
        <ul className={panel}>
          {items.map((item) => (
            <li
              key={item.kind === "post" ? `${item.targetType}:${item.id}` : `report:${item.id}`}
              className={modRowLine}
            >
              {item.kind === "post" ? (
                <PostRow post={item} onReject={setRejecting} />
              ) : (
                <ReportRow report={item} now={now} />
              )}
            </li>
          ))}
        </ul>
      </ListShell>
      <RejectPostSheet
        post={rejecting}
        onClose={() => setRejecting(null)}
        onReject={async ({ reason, category }) => {
          if (!rejecting) return;
          await decide.mutateAsync({
            targetType: rejecting.targetType,
            id: rejecting.id,
            decision: "reject",
            reason,
            category,
          });
          toast.success("Post rejected. The author was told.");
          setRejecting(null);
        }}
      />
    </>
  );
}

const emptyHistory = {
  resolved: "No handled reports yet.",
  dismissed: "No dismissed reports yet.",
} as const;

/** Closed reports. They are history, so there is nothing to approve or reject here. */
function HistoryList({ status }: { status: keyof typeof emptyHistory }) {
  const list = useInfiniteQuery(modReportsList(status));
  const reports = list.data?.pages.flatMap((p) => p.items) ?? [];
  const now = list.dataUpdatedAt;
  return (
    <ListShell list={list} label="reports" empty={emptyHistory[status]} count={reports.length}>
      <ul className={panel}>
        {reports.map((r) => (
          <li key={r.id} className={modRowLine}>
            <ReportRow report={r} now={now} />
          </li>
        ))}
      </ul>
    </ListShell>
  );
}

/** Loading, error and empty states around a paged list, and its "Show more" button. */
function ListShell({
  list,
  label,
  empty,
  count,
  children,
}: {
  list: UseInfiniteQueryResult<unknown, Error>;
  label: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  if (list.isPending) {
    return <SkeletonRows rows={3} row={skeletonRow} label={`Loading ${label}`} />;
  }
  if (list.isError) {
    return (
      <ErrorBlock
        title={`The ${label} didn't load`}
        message={errorMessage(list.error)}
        onRetry={() => void list.refetch()}
        retrying={list.isRefetching}
      />
    );
  }
  if (count === 0) {
    return (
      <div className={panel}>
        <EmptyState icon={InboxIcon} title={empty} />
      </div>
    );
  }
  return (
    <>
      {children}
      {list.hasNextPage ? (
        <Button
          variant="outline"
          className="w-full"
          loading={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          Show more
        </Button>
      ) : null}
    </>
  );
}
