import type { ReactNode } from "react";
import type { CourseStatus } from "../../../shared/schemas/courses";
import { CourseCode } from "./CourseCode";
import { StateMark } from "./StateMark";

/**
 * The left part of every course row: a 20px state mark, the title (15/500) over the code pill and
 * the row's own meta. Used by the List view and the Planner, so both lay courses out the same way.
 * The row's `li` sets `data-hue`, so the mark takes the course's ink.
 *
 * A choice slot nobody has taken yet (`open`) shows several codes in one pill: its title takes two
 * lines, the pill gets the full width and wraps at the slashes, and the meta flows on after it or
 * onto the next line. A single code always stays whole.
 */
export function CourseRowBody({
  code,
  title,
  status,
  waived,
  open = false,
  meta,
}: {
  /** One code, or several joined with "/" while a choice slot is still open. */
  code: string;
  title: string;
  status: CourseStatus;
  waived: boolean;
  open?: boolean;
  /** What follows the pill: the state word, credits, a badge. */
  meta?: ReactNode;
}) {
  return (
    <>
      <StateMark status={status} waived={waived} inCourse />
      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] leading-[1.35] font-medium text-ink ${open ? "line-clamp-2" : "truncate"}`}
        >
          {title}
        </p>
        <p className={`mt-1 flex min-w-0 items-center gap-2 ${open ? "flex-wrap gap-y-1" : ""}`}>
          <CourseCode
            code={code}
            hueFrom={code.split("/")[0]}
            className={open ? "max-w-full whitespace-normal wrap-anywhere" : undefined}
          />
          {meta}
        </p>
      </div>
    </>
  );
}
