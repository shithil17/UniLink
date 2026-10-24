import { dhakaMinutes } from "../../../shared/time";
import { timeToMinutes } from "../../../shared/routine";

/** The hours a day timeline covers: `from` is the first hour line, `to` the last (both 0 to 24). */
export type TimelineRange = { from: number; to: number };

/**
 * The hour range that holds every class: the hour the earliest one starts in, up to the hour the
 * latest one ends in (rounded up). Null when there are no classes. A range is at least one hour.
 */
export function timelineRange(
  entries: readonly { start: string; end: string }[],
): TimelineRange | null {
  if (entries.length === 0) return null;
  const starts = entries.map((e) => timeToMinutes(e.start) ?? 0);
  const ends = entries.map((e) => timeToMinutes(e.end) ?? 0);
  const from = Math.floor(Math.min(...starts) / 60);
  const to = Math.max(from + 1, Math.ceil(Math.max(...ends) / 60));
  return { from, to };
}

/** Hours from the top of the timeline to `minutes` after midnight (the unit of the `--at` variable). */
export const hoursFromTop = (range: TimelineRange, minutes: number) => minutes / 60 - range.from;

/**
 * Where the now marker sits, in hours from the top of the timeline, or null when `now` (read in
 * Asia/Dhaka) falls outside the hours shown: before the first class's hour or after the last ends.
 */
export function nowOffset(range: TimelineRange, now: number): number | null {
  const minutes = dhakaMinutes(now);
  return minutes < range.from * 60 || minutes > range.to * 60 ? null : hoursFromTop(range, minutes);
}

/** "9 AM", "12 PM": the label on an hour line. */
export const hourLabel = (hour: number) =>
  `${hour % 12 === 0 ? 12 : hour % 12} ${hour % 24 < 12 ? "AM" : "PM"}`;
