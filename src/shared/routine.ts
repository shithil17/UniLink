import { dhakaMinutes, dhakaWeekday } from "./time.ts";

// Day letters as printed on the NSU routine. Index = JS weekday (0 is Sunday), so the list is
// also the order of the week.
// TODO(D): confirm these letters against the printed NSU routine.
export const ROUTINE_DAYS = ["S", "M", "T", "W", "R", "F", "A"] as const;
export type RoutineDay = (typeof ROUTINE_DAYS)[number];

export const ROUTINE_DAY_NAMES: Record<RoutineDay, string> = {
  S: "Sunday",
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  R: "Thursday",
  F: "Friday",
  A: "Saturday",
};

/** The day letter for the instant `now`, worked out in Asia/Dhaka. */
export function dhakaDayLetter(now: number = Date.now()): RoutineDay {
  return ROUTINE_DAYS[dhakaWeekday(now)];
}

/** "HH:MM" (24 hour) to minutes after midnight, or null when it is not a valid time. */
export function timeToMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** Minutes after midnight to a zero-padded "HH:MM". */
export function minutesToTime(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Stored days ("MW") back to letters, in week order. Unknown characters are dropped. */
export const parseDays = (stored: string): RoutineDay[] =>
  ROUTINE_DAYS.filter((d) => stored.includes(d));

/** Letters to the stored form, in week order. */
export const joinDays = (days: readonly RoutineDay[]): string => parseDays(days.join("")).join("");

type Slot = { id: number; days: readonly RoutineDay[]; start: string; end: string };

const sharesDay = (a: Slot, b: Slot) => a.days.some((d) => b.days.includes(d));

/** Half-open: a class ending at 10:00 and another starting at 10:00 do not overlap. */
function timesOverlap(a: Slot, b: Slot): boolean {
  const [aStart, aEnd, bStart, bEnd] = [a.start, a.end, b.start, b.end].map(
    (t) => timeToMinutes(t) ?? 0,
  );
  return aStart < bEnd && bStart < aEnd;
}

/** Ids of the entries in `others` that clash with `entry` (same day, overlapping time). The entry itself is skipped. */
export function overlapsWith(entry: Slot, others: readonly Slot[]): number[] {
  return others
    .filter((o) => o.id !== entry.id && sharesDay(entry, o) && timesOverlap(entry, o))
    .map((o) => o.id);
}

/** Every clashing pair, once each, as [lowerIdFirst, higherId]. Warns only; saving is never blocked. */
export function overlaps(entries: readonly Slot[]): [number, number][] {
  const pairs: [number, number][] = [];
  entries.forEach((a, i) => {
    for (const b of entries.slice(i + 1)) {
      if (sharesDay(a, b) && timesOverlap(a, b)) pairs.push([a.id, b.id]);
    }
  });
  return pairs.map(([x, y]) => (x < y ? [x, y] : [y, x]));
}

/** The entries held on `day`, earliest start first (ties by earlier end, then id). */
export function entriesOn<T extends Slot>(entries: readonly T[], day: RoutineDay): T[] {
  return entries
    .filter((e) => e.days.includes(day))
    .toSorted(
      (a, b) =>
        (timeToMinutes(a.start) ?? 0) - (timeToMinutes(b.start) ?? 0) ||
        (timeToMinutes(a.end) ?? 0) - (timeToMinutes(b.end) ?? 0) ||
        a.id - b.id,
    );
}

/** The entries held on the Asia/Dhaka weekday of `now`, in time order. */
export function todayEntries<T extends Slot>(entries: readonly T[], now: number = Date.now()): T[] {
  return entriesOn(entries, dhakaDayLetter(now));
}

export type ClassStatus = "upcoming" | "current" | "done";

/**
 * Where a class held today stands at `now`, in Asia/Dhaka minutes: before its start it is upcoming,
 * from its start until its end (exclusive) it is current, after that done. Only call it for an
 * entry from `todayEntries`; the day is not checked here.
 */
export function entryStatus(
  entry: Pick<Slot, "start" | "end">,
  now: number = Date.now(),
): ClassStatus {
  const minutes = dhakaMinutes(now);
  if (minutes < (timeToMinutes(entry.start) ?? 0)) return "upcoming";
  return minutes < (timeToMinutes(entry.end) ?? 0) ? "current" : "done";
}

/** The class in progress, else the next one to start, from today's entries in time order. Null when none is left. */
export function nextEntry<T extends Slot>(today: readonly T[], now: number = Date.now()): T | null {
  return (
    today.find((e) => entryStatus(e, now) === "current") ??
    today.find((e) => entryStatus(e, now) === "upcoming") ??
    null
  );
}
