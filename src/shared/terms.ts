import { toDateKey, type DateKey } from "./calendar.ts";
import { dhakaDate } from "./time.ts";

export type TermSeason = "spring" | "summer" | "fall";
export type Term = { year: number; season: TermSeason };

// Month and day each term starts, in Asia/Dhaka, in calendar order. Placeholder dates until D
// confirms them against the NSU academic calendar. Fall runs until Spring starts the next year.
export const TERM_STARTS: readonly { season: TermSeason; month: number; day: number }[] = [
  { season: "spring", month: 1, day: 1 },
  { season: "summer", month: 5, day: 1 },
  { season: "fall", month: 9, day: 1 },
];

/** The term running at the instant `now`, worked out in Asia/Dhaka. */
export function currentTerm(now: number = Date.now()): Term {
  const { year, month, day } = dhakaDate(now);
  let season = TERM_STARTS[0].season;
  for (const start of TERM_STARTS) {
    if (month > start.month || (month === start.month && day >= start.day)) season = start.season;
  }
  return { year, season };
}

/**
 * The dates a term covers: from its start up to (not including) the next term's start, so Fall runs
 * into January. These come from `TERM_STARTS` until moderators set each term's real dates.
 */
export function termRange(term: Term): { start: DateKey; end: DateKey } {
  const i = TERM_STARTS.findIndex((t) => t.season === term.season);
  const start = TERM_STARTS[i];
  const next = TERM_STARTS[(i + 1) % TERM_STARTS.length];
  const nextYear = i + 1 === TERM_STARTS.length ? term.year + 1 : term.year;
  return {
    start: toDateKey(term.year, start.month, start.day),
    end: toDateKey(nextYear, next.month, next.day),
  };
}
