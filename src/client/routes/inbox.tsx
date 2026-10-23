import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { InboxIcon } from "lucide-react";
import { toast } from "@/lib/toast";
import { InboxRow } from "@/components/inbox/InboxRow";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { apiPost, errorMessage } from "@/lib/api";
import { inboxQuery, meQuery, unreadCountQuery } from "@/lib/queries";
import { staggerRow, useStagger } from "@/lib/useStagger";
import { notification, readAllResult } from "../../shared/schemas/inbox";

export const Route = createFileRoute("/inbox")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: Inbox,
});

/** A flat panel: `surface`, radius 20 (24 from `md`), no border; rows carry their own hairlines. */
const panel = "overflow-hidden rounded-panel bg-surface md:rounded-[24px]";

/** The loading row in the final layout: a 40px circle, two text lines and a short time. */
const skeletonRow = (
  <>
    <Skeleton className="size-10 shrink-0 rounded-full" />
    <div className="grid min-w-0 flex-1 gap-1.5">
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-3.5 w-4/5" />
    </div>
    <Skeleton className="h-3 w-10 shrink-0" />
  </>
);

function Inbox() {
  const queryClient = useQueryClient();
  const list = useInfiniteQuery(inboxQuery);
  const unread = useQuery(unreadCountQuery);
  const animate = useStagger("inbox");

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["inbox"] });
  const markRead = useMutation({
    mutationFn: (id: number) => apiPost(`/api/inbox/${id}/read`, notification),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });
  const markAll = useMutation({
    mutationFn: () => apiPost("/api/inbox/read-all", readAllResult),
    onSuccess: refresh,
    onError: (err) => toast.error(errorMessage(err)),
  });

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  // Ages are measured from the last fetch, so rendering stays pure.
  const now = list.dataUpdatedAt;
  const count = unread.data?.count ?? 0;

  return (
    <div className="max-w-2xl space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
            Inbox
          </h1>
          {unread.data ? (
            <p className="mt-1 text-soft tabular-nums">
              {count > 0 ? `${count} new` : "You're all caught up"}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!count || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          Mark all read
        </Button>
      </header>

      {list.isPending ? (
        <SkeletonRows rows={4} row={skeletonRow} label="Loading your inbox" />
      ) : list.isError ? (
        <ErrorBlock
          title="The inbox didn't load"
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : items.length === 0 ? (
        <div className={panel}>
          <EmptyState
            icon={InboxIcon}
            title="Nothing is waiting for you."
            description="New notifications will show up here."
          />
        </div>
      ) : (
        <>
          <ul className={`${panel}${animate ? " stagger" : ""}`}>
            {items.map((n, index) => (
              <li
                key={n.id}
                style={animate ? staggerRow(index) : undefined}
                className="border-t border-line first:border-t-0"
              >
                <InboxRow n={n} now={now} onOpen={() => markRead.mutate(n.id)} />
              </li>
            ))}
          </ul>
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
    </div>
  );
}
