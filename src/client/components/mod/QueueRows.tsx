import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { timeAgo } from "@/lib/inbox";
import { confidenceLabel, categoryLabel, postTypeLabel, ruleLabel } from "@/lib/modQueue";
import { useDecidePost, useResolveReport } from "@/lib/mod";
import { approvePostConfirm, resolveReportConfirm } from "@/lib/modConfirm";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/lib/useConfirm";
import { modRowMin } from "./modStyles";
import type { ModQueuePost, ModReport } from "../../../shared/schemas/moderation";

/** A held post: what was written, who wrote it, what the screen made of it, and approve or reject. */
export function PostRow({
  post,
  onReject,
}: {
  post: ModQueuePost;
  onReject: (post: ModQueuePost) => void;
}) {
  const decide = useDecidePost();
  const confidence = confidenceLabel(post.confidence);

  const confirm = useConfirm();
  const approve = () =>
    confirm.ask({
      ...approvePostConfirm(post),
      run: async () => {
        await decide.mutateAsync({
          targetType: post.targetType,
          id: post.id,
          decision: "approve",
        });
        toast.success("Post approved. The author was told.");
      },
    });

  return (
    <div className={`space-y-3 px-4 py-3.5 ${modRowMin}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-semibold text-ink">
          {post.author ?? "Removed account"}
        </p>
        <p className="shrink-0 text-[13px] text-faint">{postTypeLabel(post.targetType)} post</p>
      </div>
      <div className="space-y-1 text-[15px] leading-[1.4] break-words whitespace-pre-wrap text-ink">
        {post.text.map((field, i) => (
          <p key={i}>{field}</p>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-[13px] text-soft">
          {categoryLabel(post.category)}
          {confidence ? (
            <>
              {" "}
              <span className="tabular-nums">· {confidence} sure</span>
            </>
          ) : null}
          {post.model ? <> · {post.model}</> : null}
        </p>
        {post.flags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Rules that matched">
            {post.flags.map((flag) => (
              <li key={flag}>
                <Badge>{ruleLabel(flag)}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        {post.appealed ? (
          <p className="text-[13px] text-soft">The author asked a moderator to look at this.</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onReject(post)}>
          Reject
        </Button>
        <Button size="sm" onClick={approve}>
          Approve
        </Button>
      </div>
      {confirm.element}
    </div>
  );
}

/** A report, as before: the target, the reason, and dismiss or mark handled while it is open. */
export function ReportRow({ report, now }: { report: ModReport; now: number }) {
  const resolve = useResolveReport();
  const confirm = useConfirm();
  const act = (outcome: "resolved" | "dismissed", done: string) =>
    confirm.ask({
      ...resolveReportConfirm(report, outcome),
      run: async () => {
        await resolve.mutateAsync({ id: report.id, outcome });
        toast.success(done);
      },
    });

  return (
    <div className={`space-y-3 px-4 py-3.5 ${modRowMin}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[15px] font-semibold text-ink">
          {report.targetLabel ?? "Removed account"}
        </p>
        <time
          dateTime={new Date(report.createdAt).toISOString()}
          className="shrink-0 text-[13px] text-faint tabular-nums"
        >
          {timeAgo(report.createdAt, now)}
        </time>
      </div>
      <p className="text-[15px] leading-[1.4] break-words text-ink">{report.reason}</p>
      <p className="text-[13px] text-faint">Reported by {report.reporter ?? "a removed account"}</p>
      {report.resolveNote ? (
        <p className="text-[13px] text-soft">Note: {report.resolveNote}</p>
      ) : null}
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
          <Button variant="outline" size="sm" onClick={() => act("dismissed", "Report dismissed")}>
            Dismiss
          </Button>
          <Button size="sm" onClick={() => act("resolved", "Report marked handled")}>
            Mark handled
          </Button>
        </div>
      ) : null}
      {confirm.element}
    </div>
  );
}
