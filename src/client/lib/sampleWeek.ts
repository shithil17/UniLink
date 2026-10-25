import { ROUTINE_DAYS } from "../../shared/routine";
import { dhakaMinutes, dhakaWeekday } from "../../shared/time";

type Day = (typeof ROUTINE_DAYS)[number];

/** One class in the sample week, times as minutes after midnight in Asia/Dhaka. */
export type SampleClass = { code: string; days: Day[]; start: number; end: number };

const at = (h: number, m: number) => h * 60 + m;

/**
 * A made-up first-year week from courses several programs share, drawn on the login screen to show
 * what the routine looks like. It is never a student's data, and the screen says so.
 */
export const SAMPLE_WEEK: SampleClass[] = [
  { code: "ENG102", days: ["S", "T"], start: at(8, 0), end: at(9, 30) },
  { code: "MAT116", days: ["S", "T"], start: at(11, 20), end: at(12, 50) },
  { code: "PHY107", days: ["M", "W"], start: at(9, 40), end: at(11, 10) },
  { code: "HIS101", days: ["M", "W"], start: at(13, 0), end: at(14, 30) },
  { code: "BIO103", days: ["R", "A"], start: at(11, 20), end: at(12, 50) },
  { code: "BIO103L", days: ["R"], start: at(8, 0), end: at(11, 10) },
];

// The board shows 08:00 to 15:00, just the sample's span, so a 90-minute block on a phone is wide
// enough to print its code.
const BOARD_FROM = at(8, 0);
const BOARD_TO = at(15, 0);
const BOARD_SPAN = BOARD_TO - BOARD_FROM;

/** Where a class sits along its day's row, as percentages of the row's width. */
export function blockBox(start: number, end: number): { left: number; width: number } {
  return {
    left: ((start - BOARD_FROM) / BOARD_SPAN) * 100,
    width: ((end - start) / BOARD_SPAN) * 100,
  };
}

/** The classes on one day letter, earliest first. */
export function classesOn(day: Day, week: SampleClass[] = SAMPLE_WEEK): SampleClass[] {
  return week.filter((c) => c.days.includes(day)).sort((a, b) => a.start - b.start);
}

/** Today's day letter in Asia/Dhaka. `ROUTINE_DAYS` starts on Sunday, like `dhakaWeekday`. */
export function todayLetter(now: number): Day {
  return ROUTINE_DAYS[dhakaWeekday(now)];
}

/** The now line's offset as a percentage of the row, or null outside 08:00 to 15:00 Dhaka time. */
export function nowOffset(now: number): number | null {
  const minutes = dhakaMinutes(now);
  if (minutes < BOARD_FROM || minutes > BOARD_TO) return null;
  return ((minutes - BOARD_FROM) / BOARD_SPAN) * 100;
}
