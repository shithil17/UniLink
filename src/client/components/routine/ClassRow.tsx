import type { CSSProperties, ReactNode } from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { courseHue } from "@/lib/courseHue";
import { classDetails, formatRange } from "@/lib/routine";
import type { ClassStatus } from "../../../shared/routine";
import type { RoutineEntry } from "../../../shared/schemas/routine";

/**
 * One class as a block on the day timeline, in its course hue. The parent sets the hour height
 * (`--hh`); `top` and `span` are in hours from the timeline's first line, so the block sits where
 * its time is. The class in progress wears an inverted "In class now" tag, the next one an
 * outlined "Next" tag, and a finished one drops the hue for `faint` ink with a check and the word
 * "Finished", so no state is color alone. Blocks are flat: no border, no shadow.
 */
export function ClassRow({
  entry,
  title,
  status = "upcoming",
  next = false,
  top,
  span,
}: {
  entry: RoutineEntry;
  title?: string;
  status?: ClassStatus;
  /** True for the first class still to come, which gets the "Next" tag. */
  next?: boolean;
  top: number;
  span: number;
}) {
  const done = status === "done";
  const tag: ReactNode =
    status === "current" ? (
      <span className="shrink-0 rounded-full bg-hue-ink px-2 py-1 text-xs leading-none font-semibold text-hue">
        In class now
      </span>
    ) : done ? (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs leading-none font-semibold">
        <CheckIcon aria-hidden strokeWidth={1.75} className="size-3.5" />
        Finished
      </span>
    ) : next ? (
      <span className="shrink-0 rounded-full border-[1.5px] border-current px-[7px] py-[2.5px] text-xs leading-none font-semibold">
        Next
      </span>
    ) : null;
  return (
    <li
      data-hue={courseHue(entry.courseCode)}
      data-status={status}
      style={{ "--at": top, "--span": span } as CSSProperties}
      className={cn(
        "absolute right-0 left-[68px] z-[2] flex flex-col justify-center gap-px overflow-hidden rounded-row px-3 py-1",
        "top-[calc(var(--hh)_*_var(--at)_+_2px)] h-[calc(var(--hh)_*_var(--span)_-_4px)]",
        done ? "bg-tint text-faint" : "bg-hue text-hue-ink",
      )}
    >
      <p className="flex items-center gap-2">
        <strong className="shrink-0 text-[15px] leading-5 font-bold">{entry.courseCode}</strong>
        <span className="min-w-0 flex-1 truncate text-[13px]">{title}</span>
        {tag}
      </p>
      <p className="truncate text-[13px] leading-[17px] tabular-nums">
        {formatRange(entry.start, entry.end)} · {classDetails(entry)}
      </p>
    </li>
  );
}
