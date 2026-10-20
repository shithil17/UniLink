import { useInfiniteQuery, type UseInfiniteQueryResult } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { PostRow, ReportRow } from "@/components/mod/QueueRows";
import { RejectPostSheet } from "@/components/mod/RejectPostSheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api";
import { modQueueList, modReportsList, useDecidePost } from "@/lib/mod";
import { toast } from "@/lib/toast";
import type { ModQueuePost, ModReport } from "../../shared/schemas/moderation";

export const Route = createFileRoute("/mod/queue")({
  component: QueuePage,
});

const panel = "overflow-hidden rounded-panel border border-line bg-surface";
const flat = "rounded-control bg-tint";

type View = "queue" | Exclude<ModReport["status"], "open">;

function QueuePage() {
  const [view, setView] = useState<View>("queue");
  return (
    <section className="space-y-4">
      <h1 className="min-h-9 text-xl font-semibold text-ink">Review queue</h1>
      <Tabs value={view} onValueChange={(value) => setView(value as View)}>
        <TabsList aria-label="Queue view">
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
        <p className="text-sm text-soft tabular-nums" aria-live="polite">
          <span className="font-medium text-ink">{total}</span> waiting for a moderator
        </p>
      )}
      <ListShell list={list} label="queue" empty="Nothing is waiting for you." count={items.length}>
        <ul className={panel}>
          {items.map((item) => (
            <li
              key={item.kind === "post" ? `${item.targetType}:${item.id}` : `report:${item.id}`}
              className="border-b border-line last:border-b-0"
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
        pending={decide.isPending}
        onClose={() => setRejecting(null)}
        onSubmit={({ reason, category }) => {
          if (!rejecting) return;
          decide.mutate(
            {
              targetType: rejecting.targetType,
              id: rejecting.id,
              decision: "reject",
              reason,
              category,
            },
            {
              onSuccess: () => {
                toast.success("Post rejected. The author was told.");
                setRejecting(null);
              },
              onError: (err) => toast.error(errorMessage(err)),
            },
          );
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
          <li key={r.id} className="border-b border-line last:border-b-0">
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
    return (
      <div className={panel} aria-busy="true" aria-label={`Loading ${label}`}>
        {[0, 1, 2].map((n) => (
          <div key={n} className="space-y-2 border-b border-line px-4 py-3 last:border-b-0">
            <div className={`${flat} h-4 w-1/3`} />
            <div className={`${flat} h-4 w-full`} />
          </div>
        ))}
      </div>
    );
  }
  if (list.isError) {
    return (
      <div className="rounded-panel border border-line bg-surface p-6 text-center">
        <p className="font-medium text-ink">The {label} didn't load</p>
        <p className="mt-1 text-sm text-soft">{errorMessage(list.error)}</p>
        <Button variant="outline" className="mt-4" onClick={() => void list.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (count === 0) {
    return (
      <div className="rounded-panel border border-line bg-surface p-6 text-center">
        <p className="text-sm text-soft">{empty}</p>
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
          disabled={list.isFetchingNextPage}
          onClick={() => void list.fetchNextPage()}
        >
          {list.isFetchingNextPage ? "Loading" : "Show more"}
        </Button>
      ) : null}
    </>
  );
}
