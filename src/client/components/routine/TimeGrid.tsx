import type { CSSProperties, MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/focus";
import { breakableCode, classDetails, formatRange } from "@/lib/routine";
import {
  classesOn,
  dateLong,
  gridHours,
  hourLabel,
  placeDay,
  statusOn,
  weekdayShort,
} from "@/lib/routineCalendar";
import { inRange, weekdayOf, type DateKey } from "../../../shared/calendar";
import {
  minutesToTime,
  overlapsWith,
  ROUTINE_DAYS,
  timeToMinutes,
  type ClassStatus,
} from "../../../shared/routine";
import type { RoutineEntry } from "../../../shared/schemas/routine";
import { dhakaMinutes } from "../../../shared/time";
import type { ClassPreset } from "./RoutineSheet";

// ceiling: a tap on an empty slot proposes a class of the usual NSU length, snapped to half hours.
// Revisit if most classes stop being 90 minutes.
const SLOT_SNAP_MINUTES = 30;
const DEFAULT_CLASS_MINUTES = 90;
const LAST_MINUTE = 24 * 60 - 1;

const BLOCK_STYLE: Record<ClassStatus, string> = {
  upcoming: "bg-brand-soft text-ink",
  current: "bg-brand-soft text-ink ring-1 ring-brand ring-inset",
  done: "bg-tint text-faint",
};

/**
 * Classes on a time grid, one column per date: the week view (seven dates) and the day view (one).
 * Classes that clash share their slot side by side. A tap on an empty part of a column inside the
 * term proposes a new class at that day and time; the "Add class" button is the keyboard path.
 */
export function TimeGrid({
  dates,
  entries,
  term,
  today,
  now,
  titles,
  onOpen,
  onAdd,
  onPickDate,
}: {
  dates: DateKey[];
  entries: readonly RoutineEntry[];
  term: { start: DateKey; end: DateKey };
  today: DateKey;
  now: number;
  titles: ReadonlyMap<string, string>;
  onOpen: (entry: RoutineEntry) => void;
  onAdd: (preset: ClassPreset) => void;
  /** Opens a date in the day view, from its column header. Leave out for a single day. */
  onPickDate?: (date: DateKey) => void;
}) {
  const hours = gridHours(entries);
  const span = hours.end - hours.start;
  const detailed = dates.length === 1;
  const nowMinutes = dhakaMinutes(now);
  const columns: CSSProperties = {
    gridTemplateColumns: `var(--gutter) repeat(${dates.length}, minmax(0, 1fr))`,
  };
  // Distance from the grid's top for a time of day, in hour rows.
  const offset = (minutes: number) => `calc(var(--hour) * ${(minutes - hours.start * 60) / 60})`;

  const addAt = (date: DateKey) => (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || !inRange(date, term)) return;
    const box = event.currentTarget.getBoundingClientRect();
    const minutes = (span * 60 * (event.clientY - box.top)) / box.height;
    const start = Math.min(
      hours.start * 60 + Math.floor(minutes / SLOT_SNAP_MINUTES) * SLOT_SNAP_MINUTES,
      LAST_MINUTE - DEFAULT_CLASS_MINUTES,
    );
    onAdd({
      days: [ROUTINE_DAYS[weekdayOf(date)]],
      start: minutesToTime(start),
      end: minutesToTime(start + DEFAULT_CLASS_MINUTES),
    });
  };

  return (
    <div className="overflow-hidden rounded-panel border border-line bg-surface [--gutter:2.75rem] [--hour:3rem] md:[--gutter:3.5rem] md:[--hour:4rem]">
      {detailed ? null : (
        <div className="grid border-b border-line" style={columns}>
          <div />
          {dates.map((date) => {
            const isToday = date === today;
            return (
              <button
                key={date}
                type="button"
                onClick={() => onPickDate?.(date)}
                aria-label={`${dateLong(date)}${isToday ? ", today" : ""}. Open the day`}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center gap-0.5 border-l border-line py-1.5 hover:bg-tint",
                  focusRing,
                )}
              >
                <span className="text-xs text-soft">{weekdayShort(date)}</span>
                <span
                  className={cn(
                    "rounded-control px-1.5 text-sm tabular-nums",
                    isToday ? "bg-brand-soft font-semibold text-ink" : "text-ink",
                  )}
                >
                  {Number(date.slice(8))}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid" style={columns}>
        {/* Hour labels in the gutter, each centred on its line; the first sits under the top edge. */}
        <div className="relative row-start-1" style={{ height: `calc(var(--hour) * ${span})` }}>
          {Array.from({ length: span }, (_, i) => (
            <span
              key={i}
              className={cn(
                "absolute right-1.5 text-xs text-faint tabular-nums",
                i === 0 ? "top-1" : "-translate-y-1/2",
              )}
              style={i === 0 ? undefined : { top: `calc(var(--hour) * ${i})` }}
            >
              {hourLabel(hours.start + i)}
            </span>
          ))}
        </div>

        {/* Hour lines behind every column. */}
        <div
          aria-hidden="true"
          className="pointer-events-none col-start-2 -col-end-1 row-start-1"
          style={{ height: `calc(var(--hour) * ${span})` }}
        >
          {Array.from({ length: span - 1 }, (_, i) => (
            <div key={i} className="border-b border-line" style={{ height: "var(--hour)" }} />
          ))}
        </div>

        {dates.map((date, column) => {
          const held = classesOn(entries, date, term);
          const inTerm = inRange(date, term);
          return (
            <div
              key={date}
              onClick={addAt(date)}
              className={cn(
                "relative row-start-1 border-l border-line",
                inTerm ? "cursor-pointer" : "bg-tint/60",
              )}
              style={{ gridColumnStart: column + 2 }}
            >
              {placeDay(held).map(({ entry, lane, lanes }) => {
                const status = statusOn(entry, date, today, now);
                const title = titles.get(entry.courseCode);
                const clashes = overlapsWith(entry, held).length > 0;
                const start = timeToMinutes(entry.start) ?? 0;
                const end = timeToMinutes(entry.end) ?? 0;
                const label = [
                  `${entry.courseCode}${title ? ` ${title}` : ""}`,
                  formatRange(entry.start, entry.end),
                  classDetails(entry),
                  status === "current" ? "in class now" : status === "done" ? "finished" : null,
                  clashes ? "overlaps another class" : null,
                ]
                  .filter(Boolean)
                  .join(", ");
                return (
                  <button
                    key={entry.id}
                    type="button"
                    aria-label={`${label}. Edit`}
                    onClick={() => onOpen(entry)}
                    className={cn(
                      "absolute flex flex-col overflow-hidden rounded-control px-1 py-1 text-left leading-tight hover:brightness-95 md:px-1.5",
                      detailed ? "gap-0.5 text-sm" : "text-xs",
                      BLOCK_STYLE[status],
                      focusRing,
                    )}
                    style={{
                      top: `calc(${offset(start)} + 1px)`,
                      height: `calc(var(--hour) * ${(end - start) / 60} - 2px)`,
                      left: `calc(${(100 * lane) / lanes}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    }}
                  >
                    {/* On a phone a shared lane is too narrow for text; the label and the sheet carry it. */}
                    <span
                      className={cn(
                        "font-semibold wrap-break-word",
                        lanes > 1 && !detailed && "hidden md:inline",
                      )}
                    >
                      {breakableCode(entry.courseCode)}
                      {detailed && title ? (
                        <span className="font-normal text-soft"> {title}</span>
                      ) : null}
                    </span>
                    <span className={cn("tabular-nums", detailed ? "" : "hidden md:inline")}>
                      {formatRange(entry.start, entry.end)}
                    </span>
                    {detailed ? <span>{classDetails(entry)}</span> : null}
                    {!detailed && entry.room ? (
                      <span className="hidden truncate md:inline">{entry.room}</span>
                    ) : null}
                  </button>
                );
              })}

              {date === today && nowMinutes >= hours.start * 60 && nowMinutes < hours.end * 60 ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 h-0.5 bg-brand"
                  style={{ top: offset(nowMinutes) }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
