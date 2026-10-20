import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/focus";
import { formatClock } from "@/lib/routine";
import { classesOn, dateLong, statusOn, weekdayShort } from "@/lib/routineCalendar";
import { monthOf, type DateKey } from "../../../shared/calendar";
import type { RoutineEntry } from "../../../shared/schemas/routine";

// ceiling: a month cell lists three classes and counts the rest; NSU students rarely have more
// than three a day. Revisit if cells often overflow.
const CELL_CLASSES_MAX = 3;

/**
 * A month of dates, Sunday first. Each date lists its classes (short bars on a phone, where a
 * course code does not fit); dates outside the term have none. Tapping a date opens its day.
 */
export function MonthGrid({
  weeks,
  month,
  entries,
  term,
  today,
  now,
  onPickDate,
}: {
  weeks: DateKey[][];
  /** "YYYY-MM": dates of other months are printed in faint ink. */
  month: string;
  entries: readonly RoutineEntry[];
  term: { start: DateKey; end: DateKey };
  today: DateKey;
  now: number;
  onPickDate: (date: DateKey) => void;
}) {
  return (
    <div className="overflow-hidden rounded-panel border border-line bg-surface">
      <div className="grid grid-cols-7 border-b border-line" aria-hidden="true">
        {weeks[0].map((date) => (
          <span key={date} className="py-2 text-center text-xs text-soft">
            {weekdayShort(date)}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b border-line last:border-b-0">
          {week.map((date) => {
            const held = classesOn(entries, date, term);
            const isToday = date === today;
            const other = monthOf(date) !== month;
            const past = date < today;
            const count = held.length;
            return (
              <button
                key={date}
                type="button"
                onClick={() => onPickDate(date)}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${dateLong(date)}${isToday ? ", today" : ""}, ${
                  count === 0 ? "no classes" : `${count} ${count === 1 ? "class" : "classes"}`
                }. Open the day`}
                className={cn(
                  "flex min-h-16 min-w-0 flex-col gap-1 border-l border-line p-1 text-left first:border-l-0 hover:bg-tint md:min-h-28 md:p-1.5",
                  focusRing,
                )}
              >
                <span
                  className={cn(
                    "self-start rounded-control px-1 text-xs tabular-nums md:text-sm",
                    isToday
                      ? "bg-brand-soft font-semibold text-ink"
                      : other
                        ? "text-faint"
                        : "text-ink",
                  )}
                >
                  {Number(date.slice(8))}
                </span>

                {/* Phone: one bar per class, so the cell still shows how full the day is. */}
                <span className="flex flex-col gap-0.5 md:hidden" aria-hidden="true">
                  {held.slice(0, CELL_CLASSES_MAX + 1).map((e) => (
                    <span
                      key={e.id}
                      className={cn("h-1 rounded-full", past || other ? "bg-line" : "bg-soft")}
                    />
                  ))}
                </span>

                {/* Wider screens: the start time and course code of each class. */}
                <span className="hidden min-w-0 flex-col gap-0.5 md:flex" aria-hidden="true">
                  {held.slice(0, CELL_CLASSES_MAX).map((e) => {
                    const done = statusOn(e, date, today, now) === "done";
                    return (
                      <span
                        key={e.id}
                        className={cn(
                          "truncate text-xs",
                          done || other ? "text-faint" : "text-ink",
                        )}
                      >
                        <span className="text-faint tabular-nums">{formatClock(e.start)}</span>{" "}
                        <span className="font-medium">{e.courseCode}</span>
                      </span>
                    );
                  })}
                  {count > CELL_CLASSES_MAX ? (
                    <span className="text-xs text-faint tabular-nums">
                      {count - CELL_CLASSES_MAX} more
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
