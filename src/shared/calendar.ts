import { dhakaDate } from "./time.ts";

/**
 * A calendar date as "YYYY-MM-DD", meaning a day in Asia/Dhaka. It is not an instant: the math
 * below runs on UTC midnights only to count days and weekdays, so the device's zone never leaks in.
 */
export type DateKey = string;

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

export const toDateKey = (year: number, month: number, day: number): DateKey =>
  `${year}-${pad(month)}-${pad(day)}`;

const toUtc = (key: DateKey) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const fromUtc = (ms: number): DateKey => {
  const d = new Date(ms);
  return toDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

/** True for a real date written as "YYYY-MM-DD", so 2026-02-30 is refused. */
export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

/** Today's date in Asia/Dhaka at the instant `now`. */
export function dhakaToday(now: number = Date.now()): DateKey {
  const { year, month, day } = dhakaDate(now);
  return toDateKey(year, month, day);
}

export const addDays = (key: DateKey, days: number): DateKey => fromUtc(toUtc(key) + days * DAY_MS);

/** 0 is Sunday, 6 is Saturday. */
export const weekdayOf = (key: DateKey): number => new Date(toUtc(key)).getUTCDay();

/** The Sunday that starts the week holding `key` (NSU's week runs Sunday to Saturday). */
export const startOfWeek = (key: DateKey): DateKey => addDays(key, -weekdayOf(key));

/** The seven dates of the week holding `key`, Sunday first. */
export const weekOf = (key: DateKey): DateKey[] =>
  Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(key), i));

/** The same day of the month `months` away, clamped to that month's last day (31 Jan + 1 is 28 Feb). */
export function addMonths(key: DateKey, months: number): DateKey {
  const [y, m, d] = key.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return toDateKey(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, last));
}

export const monthOf = (key: DateKey) => key.slice(0, 7);

/**
 * The whole weeks covering the month that holds `key`, Sunday first: four to six rows of seven
 * dates, including the days of the months either side that fill the first and last week.
 */
export function monthWeeks(key: DateKey): DateKey[][] {
  const first = `${monthOf(key)}-01`;
  // The first week may start in the month before; every later week starts inside the month.
  const weeks = [weekOf(first)];
  let start = addDays(startOfWeek(first), 7);
  while (monthOf(start) === monthOf(key)) {
    weeks.push(weekOf(start));
    start = addDays(start, 7);
  }
  return weeks;
}

/** True when `key` is in the half-open range [start, end). Keys compare as strings. */
export const inRange = (key: DateKey, range: { start: DateKey; end: DateKey }) =>
  key >= range.start && key < range.end;
