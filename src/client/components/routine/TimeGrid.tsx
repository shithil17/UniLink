import type { CSSProperties, MouseEvent } from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/focus";
import { press } from "@/components/ui/press";
import { courseHue } from "@/lib/courseHue";
import { classDetails, formatRange } from "@/lib/routine";
import {
  classesOn,
  dateLong,
  gridHours,
  hourLabel,
  placeDay,
  statusOn,
  type Placed,
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
import { ClassTag } from "./ClassRow";
import { NowMarker } from "./NowMarker";
import type { ClassPreset } from "./RoutineSheet";

// ceiling: a tap on an empty slot proposes a class of the usual NSU length, snapped to half hours.
// Revisit if most classes stop being 90 minutes.
const SLOT_SNAP_MINUTES = 30;
const DEFAULT_CLASS_MINUTES = 90;
const LAST_MINUTE = 24 * 60 - 1;

// Hour heights in px, mirrored by the `--hour` variable on each grid. The week packs seven columns
// and uses 44; the day has room and uses 52. Block text is chosen from these (see `linesFit`).
const WEEK_HOUR_PX = 44;
const DAY_HOUR_PX = 52;
// A line of week-block text (12px type, 14px leading) and the block's top padding, in px.
const WEEK_LINE_PX = 14;
const WEEK_PAD_PX = 4;

type GridProps = {
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
};

/** Hours (fractional) a class takes. */
const durationHours = (entry: RoutineEntry) =>
  ((timeToMinutes(entry.end) ?? 0) - (timeToMinutes(entry.start) ?? 0)) / 60;

/** A hue-less block for a finished class, and the state words screen readers get. */
function describe(
  entry: RoutineEntry,
  title: string | undefined,
  status: ClassStatus,
  clashes: boolean,
) {
  return [
    `${entry.courseCode}${title ? ` ${title}` : ""}`,
    formatRange(entry.start, entry.end),
    classDetails(entry),
    status === "current" ? "in class now" : status === "done" ? "finished" : null,
    clashes ? "overlaps another class" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** The class a tap on an empty part of a column proposes: that day, at the tapped half hour. */
function proposal(
  date: DateKey,
  event: MouseEvent<HTMLDivElement>,
  firstHour: number,
  span: number,
): ClassPreset {
  const box = event.currentTarget.getBoundingClientRect();
  const minutes = (span * 60 * (event.clientY - box.top)) / box.height;
  const start = Math.min(
    firstHour * 60 + Math.floor(minutes / SLOT_SNAP_MINUTES) * SLOT_SNAP_MINUTES,
    LAST_MINUTE - DEFAULT_CLASS_MINUTES,
  );
  return {
    days: [ROUTINE_DAYS[weekdayOf(date)]],
    start: minutesToTime(start),
    end: minutesToTime(start + DEFAULT_CLASS_MINUTES),
  };
}

/** Block fill: the course hue while it is ahead or under way, a plain tint once it is over. */
const blockFill = (status: ClassStatus) =>
  status === "done" ? "bg-tint text-faint" : "bg-hue text-hue-ink";

/**
 * Classes on a time grid, one column per date: the week view (seven dates) and the day view (one).
 * Classes that clash share their slot side by side. A tap on an empty part of a column inside the
 * term proposes a new class at that day and time; the "Add class" button is the keyboard path.
 */
export function TimeGrid(props: GridProps) {
  return props.dates.length === 1 ? <DayGrid {...props} /> : <WeekGrid {...props} />;
}

/** The week: a day header per column, short hour labels, and a small centered code in each block. */
function WeekGrid({
  dates,
  entries,
  term,
  today,
  now,
  titles,
  onOpen,
  onAdd,
  onPickDate,
}: GridProps) {
  const hours = gridHours(entries);
  const span = hours.end - hours.start;
  const nowMinutes = dhakaMinutes(now);
  const height: CSSProperties = { height: `calc(var(--hour) * ${span})` };

  return (
    <div
      style={{ "--hour": `${WEEK_HOUR_PX}px` } as CSSProperties}
      className="rounded-panel bg-surface py-3 pr-2 pl-1.5 [--gutter:34px] md:[--gutter:52px]"
    >
      <div className="grid grid-cols-[var(--gutter)_repeat(7,minmax(0,1fr))] gap-x-0.5">
        <span />
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
                "grid min-h-11 justify-items-center gap-0.5 rounded-[14px] py-1.5 hover:bg-tint",
                isToday ? "bg-brand-soft text-brand-ink hover:bg-brand-soft" : "text-soft",
                press,
                focusRing,
              )}
            >
              <span
                aria-hidden="true"
                className={cn("text-xs leading-none font-medium", isToday ? "" : "text-faint")}
              >
                {ROUTINE_DAYS[weekdayOf(date)]}
              </span>
              <span aria-hidden="true" className="text-[13px] leading-none font-semibold">
                {Number(date.slice(8))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative mt-1.5" style={height}>
        {/* Today's column fill, under the hour lines. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 left-[calc(var(--gutter)+2px)] grid grid-cols-7 gap-x-0.5"
        >
          {dates.map((date) => (
            <span key={date} className={cn("rounded-[14px]", date === today && "bg-brand-soft")} />
          ))}
        </div>

        {/* Hour lines and labels. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {Array.from({ length: span + 1 }, (_, i) => (
            <div key={i} className="absolute inset-x-0" style={{ top: `calc(var(--hour) * ${i})` }}>
              <span className="absolute top-0 left-0 w-[calc(var(--gutter)-4px)] -translate-y-1/2 text-right text-xs leading-4 font-medium whitespace-nowrap text-faint">
                <span className="md:hidden">{shortHour(hours.start + i)}</span>
                <span className="hidden md:inline">{hourLabel(hours.start + i)}</span>
              </span>
              <span className="absolute right-0 left-(--gutter) h-px bg-line" />
            </div>
          ))}
        </div>

        <div className="absolute inset-y-0 right-0 left-[calc(var(--gutter)+2px)] grid grid-cols-7 gap-x-0.5">
          {dates.map((date) => {
            const held = classesOn(entries, date, term);
            const inTerm = inRange(date, term);
            return (
              <div
                key={date}
                onClick={(event) => {
                  if (event.target !== event.currentTarget || !inTerm) return;
                  onAdd(proposal(date, event, hours.start, span));
                }}
                className={cn(
                  "relative min-w-0 rounded-[14px]",
                  inTerm ? "cursor-pointer" : "bg-tint",
                )}
              >
                {placeDay(held).map((placed) => (
                  <WeekBlock
                    key={placed.entry.id}
                    placed={placed}
                    held={held}
                    status={statusOn(placed.entry, date, today, now)}
                    title={titles.get(placed.entry.courseCode)}
                    firstHour={hours.start}
                    onOpen={onOpen}
                  />
                ))}

                {date === today && nowMinutes >= hours.start * 60 && nowMinutes < hours.end * 60 ? (
                  <div
                    aria-hidden="true"
                    data-slot="now-marker"
                    style={{ "--at": (nowMinutes - hours.start * 60) / 60 } as CSSProperties}
                    className="pointer-events-none absolute inset-x-0 top-0 z-[3] h-0 [transform:translateY(calc(var(--hour)_*_var(--at)))] motion-safe:transition-transform motion-safe:duration-900 motion-safe:ease-linear"
                  >
                    <span className="absolute inset-x-0 top-[-1px] h-0.5 rounded-sm bg-brand" />
                    <span className="absolute top-[-5px] left-0 size-2.5 rounded-full bg-brand outline-2 outline-brand-soft" />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** "8a", "12p": an hour label narrow enough for the week's gutter on a phone. */
const shortHour = (hour: number) =>
  `${hour % 12 === 0 ? 12 : hour % 12}${hour % 24 < 12 ? "a" : "p"}`;

/** "CSE215L" as ["CSE", "215L"] so a narrow block stacks it; a code with no digits stays whole. */
function splitCode(code: string): [string, string | null] {
  const m = /^([A-Z]+)(\d.*)$/.exec(code);
  return m ? [m[1], m[2]] : [code, null];
}

/**
 * One class in a week column: a hue block (radius 10) with the code centered, stacked as letters
 * over digits. What does not fit is left out rather than clipped: below ~36px of width the block is
 * a bare hue (the name, time and room are in its label and in the sheet), and extra lines (a
 * check for a finished class, the room) appear only when the block is tall and wide enough.
 */
function WeekBlock({
  placed: { entry, lane, lanes },
  held,
  status,
  title,
  firstHour,
  onOpen,
}: {
  placed: Placed;
  held: readonly RoutineEntry[];
  status: ClassStatus;
  title: string | undefined;
  firstHour: number;
  onOpen: (entry: RoutineEntry) => void;
}) {
  const start = timeToMinutes(entry.start) ?? 0;
  const heightPx = durationHours(entry) * WEEK_HOUR_PX - 2;
  const lines = Math.floor((heightPx - WEEK_PAD_PX) / WEEK_LINE_PX);
  const [letters, digits] = splitCode(entry.courseCode);
  const stacked = digits !== null && lines >= 2;
  const clashes = overlapsWith(entry, held).length > 0;
  const used = stacked ? 2 : 1;
  return (
    <button
      type="button"
      data-slot="week-block"
      data-hue={courseHue(entry.courseCode)}
      data-status={status}
      title={entry.courseCode}
      aria-label={`${describe(entry, title, status, clashes)}. Edit`}
      onClick={() => onOpen(entry)}
      className={cn(
        "@container absolute overflow-hidden rounded-[10px] text-center text-xs leading-[14px] hover:brightness-95",
        blockFill(status),
        status === "current" && "outline-2 -outline-offset-2 outline-hue-ink",
        press,
        focusRing,
      )}
      style={{
        top: `calc(var(--hour) * ${start / 60 - firstHour} + 1px)`,
        height: `${heightPx}px`,
        left: `calc(${(100 * lane) / lanes}% + 1px)`,
        width: `calc(${100 / lanes}% - 2px)`,
      }}
    >
      <span className="hidden min-w-0 flex-col items-center gap-px px-px pt-1 @min-[2.25rem]:flex">
        {status === "done" && lines >= used + 1 ? (
          <CheckIcon aria-hidden strokeWidth={2} className="size-3 shrink-0" />
        ) : null}
        <b className="max-w-full truncate font-bold">{stacked ? letters : entry.courseCode}</b>
        {stacked ? <b className="max-w-full truncate font-bold">{digits}</b> : null}
        {entry.room && lines >= used + (status === "done" ? 2 : 1) ? (
          <span className="hidden max-w-full truncate font-medium @min-[3.5rem]:block">
            {entry.room}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * The day: a panel with the hour axis on the left (labels, a 2px rail, hairlines) and rounded
 * blocks (radius 16) that read as Home's timeline does: code 15/700, the title, and the state tag
 * ("In class now", "Next", "Finished"), then the time and details. Clashing classes sit side by
 * side; a narrow lane drops the title and tag, a short block keeps its first line only.
 */
function DayGrid({ dates, entries, term, today, now, titles, onOpen, onAdd }: GridProps) {
  const date = dates[0];
  const hours = gridHours(entries);
  const span = hours.end - hours.start;
  const inTerm = inRange(date, term);
  const held = classesOn(entries, date, term);
  const nowMinutes = dhakaMinutes(now);
  // The first class still to come today wears the "Next" tag.
  const nextId =
    date === today ? held.find((e) => statusOn(e, date, today, now) === "upcoming")?.id : undefined;

  return (
    <div className="rounded-panel bg-surface pt-4 pr-3.5 pb-3 pl-2">
      <div
        data-slot="timeline"
        className="relative"
        style={
          {
            "--hh": `${DAY_HOUR_PX}px`,
            height: `calc(var(--hh) * ${span})`,
          } as CSSProperties
        }
      >
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-[51px] w-0.5 rounded-sm bg-line"
        />
        {Array.from({ length: span + 1 }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="absolute inset-x-0 h-0"
            style={{ top: `calc(var(--hh) * ${i})` }}
          >
            <span className="absolute top-[-9px] left-0 w-11 pr-1.5 text-right text-xs leading-[18px] font-semibold whitespace-nowrap text-soft">
              {hourLabel(hours.start + i)}
            </span>
            <span className="absolute right-0 left-[58px] h-px bg-line opacity-70" />
          </div>
        ))}

        <div
          onClick={(event) => {
            if (event.target !== event.currentTarget || !inTerm) return;
            onAdd(proposal(date, event, hours.start, span));
          }}
          className={cn(
            "absolute inset-y-0 right-0 left-[68px] z-[2]",
            inTerm ? "cursor-pointer" : "rounded-row bg-tint",
          )}
        >
          {placeDay(held).map(({ entry, lane, lanes }) => {
            const status = statusOn(entry, date, today, now);
            const title = titles.get(entry.courseCode);
            const clashes = overlapsWith(entry, held).length > 0;
            const start = timeToMinutes(entry.start) ?? 0;
            const heightPx = durationHours(entry) * DAY_HOUR_PX - 4;
            // ceiling: under ~52px a block keeps its first line only (two lines would clip).
            const compact = heightPx < 52;
            return (
              <button
                key={entry.id}
                type="button"
                data-slot="day-block"
                data-hue={courseHue(entry.courseCode)}
                data-status={status}
                aria-label={`${describe(entry, title, status, clashes)}. Edit`}
                onClick={() => onOpen(entry)}
                className={cn(
                  "@container absolute overflow-hidden rounded-row text-left hover:brightness-95",
                  blockFill(status),
                  press,
                  focusRing,
                )}
                style={{
                  top: `calc(var(--hh) * ${start / 60 - hours.start} + 2px)`,
                  height: `${heightPx}px`,
                  left: `calc(${(100 * lane) / lanes}% + ${lane === 0 ? 0 : 2}px)`,
                  width: `calc(${100 / lanes}% - ${lanes === 1 ? 0 : 2}px)`,
                }}
              >
                <span
                  className={cn(
                    "flex h-full min-w-0 flex-col justify-center gap-px px-3",
                    compact ? "py-0" : "py-1",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <strong className="max-w-1/2 truncate text-[15px] leading-5 font-bold">
                      {entry.courseCode}
                    </strong>
                    <span className="hidden min-w-0 flex-1 truncate text-[13px] @min-[9rem]:block">
                      {title}
                    </span>
                    <span className="ml-auto hidden @min-[12rem]:inline-flex">
                      <ClassTag status={status} next={entry.id === nextId} />
                    </span>
                  </span>
                  {compact ? null : (
                    <span className="truncate text-[13px] leading-[17px] tabular-nums">
                      {formatRange(entry.start, entry.end)} · {classDetails(entry)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {date === today && nowMinutes >= hours.start * 60 && nowMinutes <= hours.end * 60 ? (
          <NowMarker offset={(nowMinutes - hours.start * 60) / 60} now={now} ring="surface" />
        ) : null}
      </div>
    </div>
  );
}
