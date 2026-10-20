import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { classDetails, formatClock } from "@/lib/routine";
import type { ClassStatus } from "../../../shared/routine";
import type { RoutineEntry } from "../../../shared/schemas/routine";

/**
 * One class on the time rail: start and end on the left, a hairline, then the course. The class in
 * progress sits on `brand-soft` and says "Now"; a finished one is printed in `faint` ink and says
 * "Finished" to screen readers, so neither state is color alone.
 */
export function ClassRow({
  entry,
  title,
  status = "upcoming",
  note,
  action,
}: {
  entry: RoutineEntry;
  title?: string;
  status?: ClassStatus;
  /** An extra line under the details, such as an overlap warning. */
  note?: ReactNode;
  /** A control on the right edge, such as the edit button. */
  action?: ReactNode;
}) {
  const done = status === "done";
  return (
    <li
      className={cn(
        "grid grid-cols-[6rem_minmax(0,1fr)] border-b border-line",
        status === "current" && "bg-brand-soft",
      )}
    >
      <div className="py-3 pr-3 pl-2 text-right text-sm whitespace-nowrap tabular-nums">
        <p className={cn("font-medium", done ? "text-faint" : "text-ink")}>
          {formatClock(entry.start)}
        </p>
        <p className={done ? "text-faint" : "text-soft"}>{formatClock(entry.end)}</p>
      </div>
      <div className="flex min-w-0 items-start gap-1 border-l border-line py-3 pr-1 pl-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 text-sm">
            <span className={cn("shrink-0 font-semibold", done ? "text-faint" : "text-ink")}>
              {entry.courseCode}
            </span>
            {title ? (
              <span className={cn("truncate", done ? "text-faint" : "text-soft")}>{title}</span>
            ) : null}
            {status === "current" ? (
              <span className="ml-auto shrink-0 text-xs font-semibold text-ink">Now</span>
            ) : null}
            {done ? <span className="sr-only">Finished</span> : null}
          </p>
          <p className={cn("text-sm", done ? "text-faint" : "text-soft")}>{classDetails(entry)}</p>
          {note}
        </div>
        {action}
      </div>
    </li>
  );
}
