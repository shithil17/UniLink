import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { focusRingInset } from "@/components/ui/focus";
import { apiPost, errorMessage } from "@/lib/api";
import { notificationCopy, timeAgo } from "@/lib/inbox";
import { inboxQuery, meQuery, unreadCountQuery } from "@/lib/queries";
import { notification, readAllResult, type Notification } from "../../shared/schemas/inbox";

export const Route = createFileRoute("/inbox")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: Inbox,
});

const panel = "overflow-hidden rounded-panel border border-line bg-surface";
const rowBase = "flex w-full items-start gap-3 px-4 py-3 text-left";
/** A flat placeholder for loading: the final layout, no shimmer. */
const flat = "rounded-control bg-tint";

function Inbox() {
  const queryClient = useQueryClient();
  const list = useInfiniteQuery(inboxQuery);
  const unread = useQuery(unreadCountQuery);

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

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex min-h-9 items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Inbox</h1>
        <Button
          variant="outline"
          size="sm"
          disabled={!unread.data?.count || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          Mark all read
        </Button>
      </div>

      {list.isPending ? (
        <div className={panel} aria-busy="true" aria-label="Loading your inbox">
          {[0, 1, 2].map((n) => (
            <div key={n} className="space-y-2 border-b border-line px-4 py-3 last:border-b-0">
              <div className={`${flat} h-4 w-2/3`} />
              <div className={`${flat} h-4 w-full`} />
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">The inbox didn't load</p>
          <p className="mt-1 text-sm text-soft">{errorMessage(list.error)}</p>
          <Button variant="outline" className="mt-4" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">Nothing here yet</p>
          <p className="mt-1 text-sm text-soft">
            Updates about your posts and requests will show up here.
          </p>
        </div>
      ) : (
        <>
          <ul className={panel}>
            {items.map((n) => (
              <li key={n.id} className="border-b border-line last:border-b-0">
                <Row n={n} now={now} onOpen={() => markRead.mutate(n.id)} />
              </li>
            ))}
          </ul>
          {list.hasNextPage ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? "Loading" : "Show older"}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function Row({ n, now, onOpen }: { n: Notification; now: number; onOpen: () => void }) {
  const { title, detail } = notificationCopy(n.type);
  const unread = n.readAt === null;
  const body = (
    <>
      {/* A filled dot marks unread; the hidden text carries it for screen readers. */}
      <span
        className="mt-1.5 flex size-2 shrink-0 items-center justify-center"
        aria-hidden={!unread}
      >
        {unread ? <span className="size-2 rounded-full bg-brand" /> : null}
        {unread ? <span className="sr-only">Unread. </span> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm text-ink ${unread ? "font-semibold" : "font-medium"}`}>
          {title}
        </span>
        <span className="mt-0.5 block text-sm text-soft">{detail}</span>
      </span>
      <time
        dateTime={new Date(n.createdAt).toISOString()}
        className="shrink-0 pt-0.5 text-xs text-faint tabular-nums"
      >
        {timeAgo(n.createdAt, now)}
      </time>
    </>
  );

  // Only an unread row is a control: opening it marks it read.
  return unread ? (
    <button
      type="button"
      onClick={onOpen}
      className={`${rowBase} transition-colors hover:bg-tint ${focusRingInset}`}
    >
      {body}
    </button>
  ) : (
    <div className={rowBase}>{body}</div>
  );
}
