import { CourseCode } from "@/components/courses/CourseCode";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { courseHue } from "@/lib/courseHue";
import { classesOn, dateLong } from "@/lib/routineCalendar";
import { cn } from "@/lib/utils";
import { monthOf, weekdayOf, type DateKey } from "../../../shared/calendar";
import { ROUTINE_DAYS } from "../../../shared/routine";
import type { RoutineEntry } from "../../../shared/schemas/routine";

// ceiling: a month cell draws a dot for up to three classes and counts the rest in its accessible
// name; NSU students rarely have more than three a day. Revisit if cells often overflow.
export const CELL_DOTS_MAX = 3;

/** "no classes", "2 classes" or "5 classes, 2 more than the dots show": the cell's class count. */
function classCount(count: number): string {
  if (count === 0) return "no classes";
  const base = `${count} ${count === 1 ? "class" : "classes"}`;
  return count > CELL_DOTS_MAX ? `${base}, ${count - CELL_DOTS_MAX} more than the dots show` : base;
}

/**
 * A month of dates, Sunday first, on one flat panel. Each date is a 48px cell: the date in a 30px
 * circle (today is filled `brand`) and up to three dots, one per class, in the class's hue. Dates
 * outside the term have no dots. Under the panel, the courses held print their codes in their hue,
 * so a dot's color is never the only way to tell the course. Tapping a date opens its day.
 */
export function MonthGrid({
  weeks,
  month,
  entries,
  term,
  today,
  onPickDate,
}: {
  weeks: DateKey[][];
  /** "YYYY-MM": dates of other months are printed in faint ink. */
  month: string;
  entries: readonly RoutineEntry[];
  term: { start: DateKey; end: DateKey };
  today: DateKey;
  /** Kept so callers need not change; a cell reads a class's place from its date alone. */
  now?: number;
  onPickDate: (date: DateKey) => void;
}) {
  const codes = [...new Set(entries.map((e) => e.courseCode))].toSorted();
  return (
    <div className="grid gap-3">
      <div className="rounded-panel bg-surface px-2 py-3 md:px-3">
        <div className="grid grid-cols-7 gap-y-0.5">
          {weeks[0].map((date) => (
            <span
              key={date}
              aria-hidden="true"
              className="text-center text-[13px] leading-7 font-semibold text-faint"
            >
              {ROUTINE_DAYS[weekdayOf(date)]}
            </span>
          ))}
          {weeks.flat().map((date) => {
            const held = classesOn(entries, date, term);
            const isToday = date === today;
            const other = monthOf(date) !== month;
            return (
              <button
                key={date}
                type="button"
                onClick={() => onPickDate(date)}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${dateLong(date)}${isToday ? ", today" : ""}, ${classCount(held.length)}. Open the day`}
                className={cn(
                  "grid h-12 min-w-0 content-center justify-items-center gap-[3px] rounded-control hover:bg-tint",
                  press,
                  focusRing,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-7.5 place-items-center rounded-full text-[15px] leading-none tabular-nums",
                    isToday
                      ? "bg-brand font-bold text-primary-foreground"
                      : other
                        ? "font-medium text-faint"
                        : "font-medium text-ink",
                  )}
                >
                  {Number(date.slice(8))}
                </span>
                <span
                  aria-hidden="true"
                  data-slot="month-dots"
                  className={cn("flex h-1.5 gap-[3px]", other && "opacity-50")}
                >
                  {held.slice(0, CELL_DOTS_MAX).map((e) => (
                    <span
                      key={e.id}
                      data-slot="month-dot"
                      data-hue={courseHue(e.courseCode)}
                      className="size-1.5 rounded-full bg-hue-ink"
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {codes.length > 0 ? (
        <ul aria-label="Courses in this term" className="flex flex-wrap gap-2">
          {codes.map((code) => (
            <li key={code}>
              <CourseCode code={code} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
