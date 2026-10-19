import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  /** A real zero prints as 0; leave undefined to show no count. */
  count?: number;
  /** A link or button on the right edge. */
  action?: ReactNode;
  /** The heading element; pick the level that fits the page outline. */
  as?: "h1" | "h2" | "h3";
  /** An id on the heading, for `aria-labelledby` and anchors. */
  id?: string;
  className?: string;
};

/** A sentence-case title with an optional count and action, over a hairline. */
export function SectionHeader({ title, count, action, as: Heading = "h2", id, className }: Props) {
  return (
    <div
      className={cn(
        "flex min-h-9 items-baseline justify-between gap-3 border-b border-line pb-2",
        className,
      )}
    >
      <Heading
        id={id}
        className="flex scroll-mt-20 items-baseline gap-2 text-base font-semibold text-ink"
      >
        {title}
        {count === undefined ? null : (
          <span className="text-sm font-normal text-faint tabular-nums">{count}</span>
        )}
      </Heading>
      {action ? <div className="shrink-0 text-sm">{action}</div> : null}
    </div>
  );
}
