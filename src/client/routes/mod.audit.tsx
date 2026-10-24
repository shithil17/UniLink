import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ScrollTextIcon } from "lucide-react";
import { toast } from "@/lib/toast";
import { modPanel as panel, modRowLine, modRowMin, modTitle } from "@/components/mod/modStyles";
import { useConfirm } from "@/lib/useConfirm";
import { ReasonForm } from "@/components/mod/ReasonForm";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/inbox";
import { auditList, useReverse } from "@/lib/mod";
import { reverseConfirm } from "@/lib/modConfirm";
import { meQuery } from "@/lib/queries";
import { auditActionLabel } from "../../shared/auditActions";
import type { AuditEntry } from "../../shared/schemas/moderation";

export const Route = createFileRoute("/mod/audit")({
  // Only admins read the log and reverse from it; mods are sent back to the queue.
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null);
    if (user?.role !== "admin") throw redirect({ to: "/mod/queue" });
  },
  component: AuditPage,
});

/** The loading row in the final layout: action and age, then who and what. */
const skeletonRow = (
  <div className="grid min-w-0 flex-1 gap-2 py-1">
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-3.5 w-2/3" />
  </div>
);

function AuditPage() {
  const { data: me } = useQuery(meQuery);
  const list = useInfiniteQuery(auditList);
  const [target, setTarget] = useState<AuditEntry | null>(null);
  const entries = list.data?.pages.flatMap((p) => p.items) ?? [];
  const now = list.dataUpdatedAt;

  return (
    <section className="space-y-4">
      <h1 className={modTitle}>Audit log</h1>
      <p className="text-soft">
        Every mod and automatic action, newest first. Reversing puts back what the action changed
        and is logged too.
      </p>

      {list.isPending ? (
        <SkeletonRows rows={4} row={skeletonRow} label="Loading the audit log" />
      ) : list.isError ? (
        <ErrorBlock
          title="The log didn't load"
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : entries.length === 0 ? (
        <div className={panel}>
          <EmptyState icon={ScrollTextIcon} title="Nothing has been logged yet." />
        </div>
      ) : (
        <>
          <ul className={panel}>
            {entries.map((e) => (
              <li key={e.id} className={modRowLine}>
                <EntryRow
                  entry={e}
                  now={now}
                  onReverse={me?.role === "admin" ? () => setTarget(e) : undefined}
                />
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

      <ReverseSheet entry={target} onClose={() => setTarget(null)} />
    </section>
  );
}

function EntryRow({
  entry,
  now,
  onReverse,
}: {
  entry: AuditEntry;
  now: number;
  onReverse?: () => void;
}) {
  const what = entry.targetLabel ?? `${entry.targetType} ${entry.targetId}`;
  const note = entry.reverses
    ? `Reverses entry ${entry.reverses}`
    : entry.reversedBy
      ? `Reversed in entry ${entry.reversedBy}`
      : null;

  return (
    <div className={`space-y-1 px-4 py-3 ${modRowMin}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-[15px] font-semibold text-ink">
          {auditActionLabel(entry.action)}
        </p>
        <time
          dateTime={new Date(entry.createdAt).toISOString()}
          className="shrink-0 text-[13px] text-faint tabular-nums"
        >
          {timeAgo(entry.createdAt, now)}
        </time>
      </div>
      <p className="text-[13px] text-soft">
        {entry.actor} on {what}
      </p>
      {entry.reason ? (
        <p className="text-[15px] leading-[1.4] break-words text-ink">{entry.reason}</p>
      ) : null}
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-[13px] text-faint tabular-nums">
          Entry {entry.id}
          {note ? `. ${note}` : ""}
        </p>
        {entry.reversible && onReverse ? (
          <Button variant="outline" size="sm" onClick={onReverse}>
            Reverse
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ReverseSheet({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  const reverse = useReverse();
  const confirm = useConfirm();

  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom">
        {entry ? (
          <>
            <SheetHeader>
              <SheetTitle>Reverse this action</SheetTitle>
              <SheetDescription>
                {auditActionLabel(entry.action)} on{" "}
                {entry.targetLabel ?? `${entry.targetType} ${entry.targetId}`}. It puts back what
                the action changed.
              </SheetDescription>
            </SheetHeader>
            <div className="px-5 pb-4">
              <ReasonForm
                key={entry.id}
                id={`reverse-${entry.id}`}
                submitLabel="Reverse"
                variant="destructive"
                onCancel={onClose}
                onSubmit={(reason) =>
                  confirm.ask({
                    ...reverseConfirm(entry, reason),
                    run: async () => {
                      await reverse.mutateAsync({ id: entry.id, reason });
                      toast.success("Action reversed");
                      onClose();
                    },
                  })
                }
              />
            </div>
            {confirm.element}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
