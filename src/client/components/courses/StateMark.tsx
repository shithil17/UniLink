import { cn } from "@/lib/utils";
import { STATE_LABEL, stateKind, type StateKind } from "@/lib/stateKind";
import type { CourseStatus } from "../../../shared/schemas/courses";

/** Shape carries the state, never color alone: filled = done, hollow = available, struck = locked, half = waived. */
function Shape({ kind }: { kind: StateKind }) {
  switch (kind) {
    case "done":
      return <circle data-shape="filled" cx="8" cy="8" r="6.5" fill="currentColor" />;
    case "available":
      return (
        <circle
          data-shape="hollow"
          cx="8"
          cy="8"
          r="5.75"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      );
    case "locked":
      return (
        <g data-shape="struck" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="5.75" />
          <path d="M1.5 8h13" strokeLinecap="round" />
        </g>
      );
    case "waived":
      return (
        <g data-shape="half">
          <circle cx="8" cy="8" r="5.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 2.25a5.75 5.75 0 0 0 0 11.5z" fill="currentColor" />
        </g>
      );
  }
}

const TONE: Record<StateKind, string> = {
  done: "text-brand",
  available: "text-ink",
  locked: "text-faint",
  waived: "text-brand",
};

type Props = {
  status: CourseStatus;
  /** A done course that was waived shows the half mark. */
  waived?: boolean;
  /** Print the label next to the mark (a drop-in for the old status chip). */
  showLabel?: boolean;
  className?: string;
};

/** The printed mark for a course's state, with an accessible label. */
export function StateMark({ status, waived = false, showLabel = false, className }: Props) {
  const kind = stateKind(status, waived);
  const label = STATE_LABEL[kind];
  const mark = (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-4 shrink-0", TONE[kind], !showLabel && className)}
      role={showLabel ? undefined : "img"}
      aria-label={showLabel ? undefined : label}
      aria-hidden={showLabel ? true : undefined}
      data-state={kind}
    >
      <Shape kind={kind} />
    </svg>
  );
  if (!showLabel) return mark;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-ink", className)}>
      {mark}
      {label}
    </span>
  );
}
