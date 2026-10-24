import { cn } from "@/lib/utils";
import { STATE_LABEL, stateKind, type StateKind } from "@/lib/stateKind";
import type { CourseStatus } from "../../../shared/schemas/courses";

/** Shape carries the state, never color alone: filled = done, hollow = available, struck = locked, half = waived. */
const SHAPE: Record<StateKind, "filled" | "hollow" | "struck" | "half"> = {
  done: "filled",
  available: "hollow",
  locked: "struck",
  waived: "half",
};

/** Every layer stays mounted so a state change (a saved grade) animates instead of swapping. */
const FILL =
  "origin-[12px_12px] motion-safe:transition-[scale,opacity] motion-safe:duration-220 motion-safe:ease-ui-out";
const SHOWN = "scale-100 opacity-100";
const HIDDEN = "scale-90 opacity-0 motion-reduce:scale-100";

type Props = {
  status: CourseStatus;
  /** A done course that was waived shows the half mark. */
  waived?: boolean;
  /** Print the label next to the mark (a drop-in for the old status chip). */
  showLabel?: boolean;
  /** Edge in px: 20 by default, 28 for specimens, 18 in prerequisite lists. */
  size?: number;
  /** Inside a `data-hue` course context the mark takes the hue's ink; otherwise it is `ink`. */
  inCourse?: boolean;
  className?: string;
};

/** The printed mark for a course's state, with an accessible label. */
export function StateMark({
  status,
  waived = false,
  showLabel = false,
  size = 20,
  inCourse = false,
  className,
}: Props) {
  const kind = stateKind(status, waived);
  const label = STATE_LABEL[kind];
  const mark = (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cn(
        "shrink-0 overflow-visible",
        inCourse ? "text-hue-ink" : "text-ink",
        !showLabel && className,
      )}
      role={showLabel ? undefined : "img"}
      aria-label={showLabel ? undefined : label}
      aria-hidden={showLabel ? true : undefined}
      data-state={kind}
      data-shape={SHAPE[kind]}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="currentColor"
        className={cn(FILL, kind === "done" ? SHOWN : HIDDEN)}
      />
      <path
        d="M12 3a9 9 0 0 0 0 18z"
        fill="currentColor"
        className={kind === "waived" ? "opacity-100" : "opacity-0"}
      />
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5.6 5.6l12.8 12.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className={kind === "locked" ? "opacity-100" : "opacity-0"}
      />
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
