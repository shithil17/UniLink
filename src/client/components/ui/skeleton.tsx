import * as React from "react";
import { cn } from "cn";

/**
 * One loading bar: a `track` block with an 8px radius whose opacity pulses 1 to 0.45 (1.2s,
 * ease-in-out, alternating). The pulse is `motion-safe:`, so reduced motion gets a still bar.
 * Size it with `h-*`/`w-*` to the content it stands in for.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("rounded-[8px] bg-track motion-safe:animate-skeleton", className)}
      {...props}
    />
  );
}

/** The default placeholder row: a 20px mark, a two-line label and a short trailing figure. */
function SkeletonRow() {
  return (
    <>
      <Skeleton className="size-5 shrink-0 rounded-full" />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
      <Skeleton className="h-4 w-8 shrink-0" />
    </>
  );
}

/**
 * A panel of placeholder rows in the final row layout (60px, hairline between), so the screen does
 * not jump when data arrives. Pass `row` to draw the real row's shape instead of the default. The
 * panel is one busy status region that reads "Loading" once, whatever the row count.
 */
function SkeletonRows({
  rows = 3,
  row,
  label = "Loading",
  className,
}: {
  rows?: number;
  row?: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      data-slot="skeleton-rows"
      className={cn("overflow-hidden rounded-panel bg-surface md:rounded-[24px]", className)}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          data-slot="skeleton-row"
          className={cn(
            "flex min-h-[60px] items-center gap-3 px-4 py-2.5",
            index > 0 && "border-t border-line",
          )}
        >
          {row ?? <SkeletonRow />}
        </div>
      ))}
    </div>
  );
}

export { Skeleton, SkeletonRow, SkeletonRows };
