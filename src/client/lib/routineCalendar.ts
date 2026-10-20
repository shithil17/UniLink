import {
  addDays,
  addMonths,
  inRange,
  startOfWeek,
  weekdayOf,
  type DateKey,
} from "../../shared/calendar";
import {
  entriesOn,
  entryStatus,
  ROUTINE_DAYS,
  timeToMinutes,
  type ClassStatus,
} from "../../shared/routine";
import type { RoutineEntry } from "../../shared/schemas/routine";

export const CALENDAR_VIEWS = ["month", "week", "day"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

type Range = { start: DateKey; end: DateKey };

/** The classes held on a date, in time order. None outside the term: the routine repeats only inside it. */
export function classesOn(
  entries: readonly RoutineEntry[],
  date: DateKey,
  term: Range,
): RoutineEntry[] {
  return inRange(date, term) ? entriesOn(entries, ROUTINE_DAYS[weekdayOf(date)]) : [];
}

/** Where a class on `date` stands at `now`: earlier dates are done, later ones upcoming. */
export function statusOn(
  entry: Pick<RoutineEntry, "start" | "end">,
  date: DateKey,
  today: DateKey,
  now: number,
): ClassStatus {
  if (date < today) return "done";
  if (date > today) return "upcoming";
  return entryStatus(entry, now);
}

// ceiling: the grid always shows 8 AM to 6 PM, NSU's teaching day, and grows to fit any class
// outside it. Revisit if the university moves its day.
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;

/** The whole hours the time grid shows: the teaching day, widened to fit every class. */
export function gridHours(entries: readonly RoutineEntry[]): { start: number; end: number } {
  let start = DAY_START_HOUR;
  let end = DAY_END_HOUR;
  for (const e of entries) {
    start = Math.min(start, Math.floor((timeToMinutes(e.start) ?? 0) / 60));
    end = Math.max(end, Math.ceil((timeToMinutes(e.end) ?? 0) / 60));
  }
  return { start, end };
}

export type Placed = { entry: RoutineEntry; lane: number; lanes: number };

/**
 * Side-by-side lanes for one day's classes, as a calendar draws clashes. Classes that overlap,
 * directly or through a chain, form a group; each takes the first free lane, and every class in a
 * group shares the group's lane count so their widths match. Touching times do not overlap.
 */
export function placeDay(entries: readonly RoutineEntry[]): Placed[] {
  const sorted = entries.toSorted(
    (a, b) =>
      (timeToMinutes(a.start) ?? 0) - (timeToMinutes(b.start) ?? 0) ||
      (timeToMinutes(a.end) ?? 0) - (timeToMinutes(b.end) ?? 0) ||
      a.id - b.id,
  );
  const placed: Placed[] = [];
  let group: Placed[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    for (const p of group) p.lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  };
  for (const entry of sorted) {
    const start = timeToMinutes(entry.start) ?? 0;
    const end = timeToMinutes(entry.end) ?? 0;
    if (start >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;
    const p = { entry, lane, lanes: 1 };
    group.push(p);
    placed.push(p);
    groupEnd = Math.max(groupEnd, end);
  }
  closeGroup();
  return placed;
}

/** The date the arrows move to: a month, a week or a day away. */
export function stepDate(view: CalendarView, date: DateKey, direction: 1 | -1): DateKey {
  if (view === "month") return addMonths(date, direction);
  return addDays(date, view === "week" ? 7 * direction : direction);
}

// Dates are formatted at UTC midnight with the UTC zone, so the label is the calendar date itself.
const at = (date: DateKey) => new Date(`${date}T00:00:00Z`);
const format = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });
const monthYear = format({ month: "long", year: "numeric" });
const monthDay = format({ month: "short", day: "numeric" });
const fullDay = format({ weekday: "long", month: "short", day: "numeric" });
const shortWeekday = format({ weekday: "short" });
const longDate = format({ weekday: "long", month: "long", day: "numeric", year: "numeric" });

/** "October 2026", "Oct 18 - 24", "Oct 25 - Nov 1" or "Tuesday, Oct 21": what the view is showing. */
export function periodLabel(view: CalendarView, date: DateKey): string {
  if (view === "month") return monthYear.format(at(date));
  if (view === "day") return fullDay.format(at(date));
  const first = startOfWeek(date);
  const last = addDays(first, 6);
  const lastLabel =
    first.slice(0, 7) === last.slice(0, 7)
      ? String(Number(last.slice(8)))
      : monthDay.format(at(last));
  return `${monthDay.format(at(first))} - ${lastLabel}`;
}

/** "Sun", "Mon", ... for a column header. */
export const weekdayShort = (date: DateKey) => shortWeekday.format(at(date));

/** "Tuesday, October 21, 2026", for screen readers. */
export const dateLong = (date: DateKey) => longDate.format(at(date));

/** "8 AM", "12 PM": an hour label on the grid's left edge. */
export const hourLabel = (hour: number) =>
  `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 || hour === 24 ? "AM" : "PM"}`;
