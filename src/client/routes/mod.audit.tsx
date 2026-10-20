import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ReasonForm } from "@/components/mod/ReasonForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/inbox";
import { auditList, useReverse } from "@/lib/mod";
import { meQuery } from "@/lib/queries";
import { auditActionLabel } from "../../shared/auditActions";
import type { AuditEntry } from "../../shared/schemas/moderation";

export const Route = createFileRoute("/mod/audit")({
  // Only admins read the log and reverse from it; mods are sent back to the queue.
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(meQuery).catch(() => null);
    if (user?.role !== "admin") throw redirect({ to: "/mod/reports" });
  },
  component: AuditPage,
});

const panel = "overflow-hidden rounded-panel border border-line bg-surface";
const flat = "rounded-control bg-tint";

function AuditPage() {
  const { data: me } = useQuery(meQuery);
  const list = useInfiniteQuery(auditList);
  const [target, setTarget] = useState<AuditEntry | null>(null);
  const entries = list.data?.pages.flatMap((p) => p.items) ?? [];
  const now = list.dataUpdatedAt;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">Audit log</h1>
      <p className="text-sm text-soft">
        Every mod and automatic action, newest first. Reversing puts back what the action changed
        and is logged too.
      </p>

      {list.isPending ? (
        <div className={panel} aria-busy="true" aria-label="Loading the audit log">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="space-y-2 border-b border-line px-4 py-3 last:border-b-0">
              <div className={`${flat} h-4 w-1/2`} />
              <div className={`${flat} h-4 w-2/3`} />
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">The log didn't load</p>
          <p className="mt-1 text-sm text-soft">{errorMessage(list.error)}</p>
          <Button variant="outline" className="mt-4" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="text-sm text-soft">Nothing has been logged yet.</p>
        </div>
      ) : (
        <>
          <ul className={panel}>
            {entries.map((e) => (
              <li key={e.id} className="border-b border-line last:border-b-0">
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
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? "Loading" : "Show older"}
            </Button>
          ) : null}
        </>
      )}

      <ReverseDialog entry={target} onClose={() => setTarget(null)} />
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
    <div className="space-y-1 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-medium text-ink">{auditActionLabel(entry.action)}</p>
        <time
          dateTime={new Date(entry.createdAt).toISOString()}
          className="shrink-0 text-xs text-faint tabular-nums"
        >
          {timeAgo(entry.createdAt, now)}
        </time>
      </div>
      <p className="text-sm text-soft">
        {entry.actor} on {what}
      </p>
      {entry.reason ? <p className="text-sm break-words text-body">{entry.reason}</p> : null}
      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className="text-xs text-faint tabular-nums">
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

function ReverseDialog({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  const reverse = useReverse();
  const [serverError, setServerError] = useState<string | null>(null);

  const close = () => {
    setServerError(null);
    reverse.reset();
    onClose();
  };

  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        {entry ? (
          <>
            <DialogHeader>
              <DialogTitle>Reverse this action</DialogTitle>
              <DialogDescription>
                {auditActionLabel(entry.action)} on{" "}
                {entry.targetLabel ?? `${entry.targetType} ${entry.targetId}`}. It puts back what
                the action changed.
              </DialogDescription>
            </DialogHeader>
            <ReasonForm
              key={entry.id}
              id={`reverse-${entry.id}`}
              submitLabel="Reverse"
              pendingLabel="Reversing"
              pending={reverse.isPending}
              serverError={serverError}
              onCancel={close}
              onSubmit={(reason) => {
                setServerError(null);
                reverse.mutate(
                  { id: entry.id, reason },
                  {
                    onSuccess: () => {
                      toast.success("Action reversed");
                      close();
                    },
                    onError: (err) => setServerError(errorMessage(err)),
                  },
                );
              }}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
