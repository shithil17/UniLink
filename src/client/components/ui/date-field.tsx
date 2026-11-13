import * as React from "react";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { pickerTrigger } from "@/components/courses/OptionSelect";
import { Button } from "@/components/ui/button";
import { focusRing, focusRingInset } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  dateLong,
  dateShort,
  monthGridWeeks,
  periodLabel,
  weekdayShort,
} from "@/lib/routineCalendar";
import {
  addDays,
  addMonths,
  dhakaToday,
  isDateKey,
  monthOf,
  startOfWeek,
  type DateKey,
} from "../../../shared/calendar";

type DateFieldProps = Omit<
  React.ComponentProps<"button">,
  "value" | "onChange" | "type" | "children" | "aria-label"
> & {
  /** "YYYY-MM-DD", or an empty string for no date. The same string a native date input would hold. */
  value: string;
  onChange: (value: string) => void;
  /** The field's name, said by screen readers with the picked date ("Runs until, Wednesday, 21 October 2026"). */
  label: string;
  /** "YYYY-MM-DD" bounds, both inclusive. Days outside them cannot be picked. */
  min?: string;
  max?: string;
  /** Adds a Clear action to the calendar, for a field that may stay empty. */
  clearable?: boolean;
  /** What the button says while no date is picked. */
  placeholder?: string;
  /** "Today" for the calendar's marker and its first view; Asia/Dhaka's date when left out. */
  today?: DateKey;
};

const PLACEHOLDER = "Pick a date";

/**
 * A date field that always reads day, month, year ("Wed, 21 Oct 2026"), whatever the browser's locale:
 * a native date input prints month first in some regions and that cannot be changed from a page. It is
 * a 48px button like the other pickers; tapping it opens a month calendar in a bottom sheet, so
 * opening it never moves the page. The value is the "YYYY-MM-DD" string a date input holds, so forms
 * and schemas treat it the same way. The ref and aria attributes go to the button, which lets React
 * Hook Form focus it on an error.
 */
export function DateField({
  value,
  onChange,
  label,
  min,
  max,
  clearable,
  placeholder = PLACEHOLDER,
  today = dhakaToday(),
  className,
  ref,
  ...button
}: DateFieldProps) {
  const [open, setOpen] = React.useState(false);
  const trigger = React.useRef<HTMLButtonElement | null>(null);
  const grid = React.useRef<HTMLDivElement>(null);
  const setRef = React.useCallback(
    (el: HTMLButtonElement | null) => {
      trigger.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  const picked = isDateKey(value) ? value : "";
  const done = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        {...button}
        ref={setRef}
        aria-label={`${label}, ${picked ? dateLong(picked) : placeholder}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(e) => {
          button.onClick?.(e);
          if (!e.defaultPrevented) setOpen(true);
        }}
        className={cn("relative", pickerTrigger, focusRingInset, className)}
      >
        <span className={cn("truncate tabular-nums", picked ? "text-ink" : "text-faint")}>
          {picked ? dateShort(picked) : placeholder}
        </span>
        <CalendarIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3.5 size-[18px] -translate-y-1/2 text-soft"
        />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          finalFocus={trigger}
          initialFocus={() =>
            grid.current?.querySelector<HTMLElement>("button[tabindex='0']") ?? true
          }
        >
          <SheetHeader className="pb-0">
            <SheetTitle>{PLACEHOLDER}</SheetTitle>
            <SheetDescription className="sr-only">
              Arrow keys move between days, Page Up and Page Down change the month, Enter picks the
              day.
            </SheetDescription>
          </SheetHeader>
          <Calendar
            gridRef={grid}
            selected={picked}
            min={min}
            max={max}
            today={today}
            onPick={done}
          />
          {clearable ? (
            <SheetFooter className="mt-0 px-5 pt-0 pb-0">
              <Button type="button" variant="outline" disabled={!picked} onClick={() => done("")}>
                Clear
              </Button>
            </SheetFooter>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Arrow keys move a day or a week, Page Up and Down a month (a year with Shift), Home and End the week. */
function moveBy(key: string, shift: boolean, from: DateKey): DateKey | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(from, -1);
    case "ArrowRight":
      return addDays(from, 1);
    case "ArrowUp":
      return addDays(from, -7);
    case "ArrowDown":
      return addDays(from, 7);
    case "PageUp":
      return addMonths(from, shift ? -12 : -1);
    case "PageDown":
      return addMonths(from, shift ? 12 : 1);
    case "Home":
      return startOfWeek(from);
    case "End":
      return addDays(startOfWeek(from), 6);
    default:
      return null;
  }
}

/**
 * One month, always six rows of seven so stepping months never changes its height. The shown month is
 * the one holding the keyboard cursor, so arrow keys carry the grid across month ends. Only the
 * cursor's day is in the tab order (a roving tabindex): Tab leaves the grid and the arrows move in it.
 */
function Calendar({
  gridRef,
  selected,
  min,
  max,
  today,
  onPick,
}: {
  gridRef: React.RefObject<HTMLDivElement | null>;
  selected: string;
  min?: string;
  max?: string;
  today: DateKey;
  onPick: (date: DateKey) => void;
}) {
  const clamp = (d: DateKey) => (min && d < min ? min : max && d > max ? max : d);
  const outside = (d: DateKey) => Boolean((min && d < min) || (max && d > max));

  // Starts on the picked day, or today. Clamped, so the cursor is never on a day that cannot be picked.
  const [cursor, setCursor] = React.useState<DateKey>(() => clamp(selected || today));
  // Set by a key press so the new cursor day takes focus once it is rendered.
  const refocus = React.useRef(false);
  React.useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    gridRef.current?.querySelector<HTMLElement>("button[tabindex='0']")?.focus();
  }, [cursor, gridRef]);

  const month = monthOf(cursor);
  const weeks = monthGridWeeks(cursor);
  const monthId = React.useId();
  const stepMonth = (by: 1 | -1) => setCursor(clamp(addMonths(cursor, by)));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (!outside(cursor)) onPick(cursor);
      return;
    }
    const next = moveBy(e.key, e.shiftKey, cursor);
    if (!next) return;
    e.preventDefault();
    refocus.current = true;
    setCursor(clamp(next));
  };

  return (
    <div className="mx-auto grid w-full max-w-sm gap-1 px-5">
      <div className="grid grid-cols-[auto_1fr_auto] items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          disabled={Boolean(min) && addDays(`${month}-01`, -1) < min!}
          onClick={() => stepMonth(-1)}
        >
          <ChevronLeftIcon aria-hidden="true" />
        </Button>
        <div
          id={monthId}
          aria-live="polite"
          className="text-center text-lg leading-[1.3] font-semibold text-ink"
        >
          {periodLabel("month", cursor)}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Next month"
          disabled={Boolean(max) && addMonths(`${month}-01`, 1) > max!}
          onClick={() => stepMonth(1)}
        >
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </div>
      <div ref={gridRef} role="grid" aria-labelledby={monthId} onKeyDown={onKeyDown}>
        <div role="row" className="grid grid-cols-7">
          {weeks[0].map((date) => (
            <span
              key={date}
              role="columnheader"
              aria-label={dateLong(date).split(",")[0]}
              className="text-center text-[13px] leading-7 font-semibold text-faint"
            >
              {weekdayShort(date).slice(0, 1)}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} role="row" className="grid grid-cols-7">
            {week.map((date) => {
              const isSelected = date === selected;
              const isToday = date === today;
              return (
                <div key={date} role="gridcell" aria-selected={isSelected}>
                  <button
                    type="button"
                    tabIndex={date === cursor ? 0 : -1}
                    disabled={outside(date)}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={`${dateLong(date)}${isToday ? ", today" : ""}`}
                    onClick={() => onPick(date)}
                    className={cn(
                      "group grid h-11 w-full min-w-0 place-items-center rounded-control outline-none disabled:pointer-events-none disabled:opacity-40",
                      press,
                      focusRing,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-9 place-items-center rounded-full text-[15px] leading-none tabular-nums",
                        isSelected
                          ? "bg-brand-soft font-bold text-brand-ink"
                          : cn(
                              "group-hover:bg-tint",
                              monthOf(date) === month
                                ? "font-medium text-ink"
                                : "font-medium text-faint",
                            ),
                        isToday && "border-[1.5px] border-brand",
                      )}
                    >
                      {Number(date.slice(8))}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
