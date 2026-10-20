import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/inbox";
import { modReportsList, useResolveReport } from "@/lib/mod";
import type { ModReport } from "../../shared/schemas/moderation";

export const Route = createFileRoute("/mod/reports")({
  component: ReportsPage,
});

const panel = "overflow-hidden rounded-panel border border-line bg-surface";
const flat = "rounded-control bg-tint";

type Status = ModReport["status"];

const empty: Record<Status, string> = {
  open: "No open reports. Nothing is waiting for you.",
  resolved: "No handled reports yet.",
  dismissed: "No dismissed reports yet.",
};

function ReportsPage() {
  const [status, setStatus] = useState<Status>("open");
  const list = useInfiniteQuery(modReportsList(status));
  const reports = list.data?.pages.flatMap((p) => p.items) ?? [];
  const now = list.dataUpdatedAt;

  return (
    <section className="space-y-4">
      <div className="flex min-h-9 items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Reports</h1>
        {status === "open" && list.data ? (
          <p className="text-sm text-soft tabular-nums">
            {reports.length}
            {list.hasNextPage ? "+" : ""} waiting
          </p>
        ) : null}
      </div>
      <Tabs value={status} onValueChange={(value) => setStatus(value as Status)}>
        <TabsList aria-label="Report status">
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Handled</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>
      </Tabs>

      {list.isPending ? (
        <div className={panel} aria-busy="true" aria-label="Loading reports">
          {[0, 1, 2].map((n) => (
            <div key={n} className="space-y-2 border-b border-line px-4 py-3 last:border-b-0">
              <div className={`${flat} h-4 w-1/3`} />
              <div className={`${flat} h-4 w-full`} />
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">The reports didn't load</p>
          <p className="mt-1 text-sm text-soft">{errorMessage(list.error)}</p>
          <Button variant="outline" className="mt-4" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="text-sm text-soft">{empty[status]}</p>
        </div>
      ) : (
        <>
          <ul className={panel}>
            {reports.map((r) => (
              <li key={r.id} className="border-b border-line last:border-b-0">
                <ReportRow report={r} now={now} />
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
              {list.isFetchingNextPage ? "Loading" : "Show more"}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

function ReportRow({ report, now }: { report: ModReport; now: number }) {
  const resolve = useResolveReport();
  const act = (outcome: "resolved" | "dismissed", done: string) =>
    resolve.mutate(
      { id: report.id, outcome },
      { onSuccess: () => toast.success(done), onError: (err) => toast.error(errorMessage(err)) },
    );

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-medium text-ink">
          {report.targetLabel ?? "Removed account"}
        </p>
        <time
          dateTime={new Date(report.createdAt).toISOString()}
          className="shrink-0 text-xs text-faint tabular-nums"
        >
          {timeAgo(report.createdAt, now)}
        </time>
      </div>
      <p className="text-sm break-words text-body">{report.reason}</p>
      <p className="text-xs text-faint">Reported by {report.reporter ?? "a removed account"}</p>
      {report.resolveNote ? <p className="text-sm text-soft">Note: {report.resolveNote}</p> : null}
      {report.status === "open" ? (
        <div className="flex flex-wrap gap-2">
          {report.targetLabel ? (
            <Link
              to="/mod/users"
              search={{ q: report.targetLabel }}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Review user
            </Link>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            disabled={resolve.isPending}
            onClick={() => act("dismissed", "Report dismissed")}
          >
            Dismiss
          </Button>
          <Button
            size="sm"
            disabled={resolve.isPending}
            onClick={() => act("resolved", "Report marked handled")}
          >
            Mark handled
          </Button>
        </div>
      ) : null}
    </div>
  );
}
