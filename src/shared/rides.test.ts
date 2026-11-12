import { describe, expect, it } from "vite-plus/test";
import { daysToMask, isDepartureTime, maskToDays, minutesToTime, timeToMinutes } from "./rides";
import { formatDhakaDate, parseDhakaDate, startOfDhakaDay } from "./time";

describe("ride weekdays", () => {
  it("round-trips a set of days through the mask, Sunday first", () => {
    expect(daysToMask(["sun"])).toBe(1);
    expect(daysToMask(["sat"])).toBe(64);
    expect(daysToMask(["mon", "wed", "mon"])).toBe(2 | 8);
    expect(maskToDays(daysToMask(["fri", "sun", "tue"]))).toEqual(["sun", "tue", "fri"]);
  });
});

describe("departure times", () => {
  it("accepts 24-hour times and refuses the rest", () => {
    expect(isDepartureTime("07:30")).toBe(true);
    expect(isDepartureTime("23:59")).toBe(true);
    expect(isDepartureTime("24:00")).toBe(false);
    expect(isDepartureTime("7:30")).toBe(false);
    expect(isDepartureTime("07:60")).toBe(false);
  });

  it("converts to and from minutes after midnight", () => {
    expect(timeToMinutes("07:30")).toBe(450);
    expect(minutesToTime(450)).toBe("07:30");
    expect(minutesToTime(timeToMinutes("23:59"))).toBe("23:59");
  });
});

describe("Dhaka dates", () => {
  it("parses real dates only", () => {
    expect(parseDhakaDate("2026-11-12")).toEqual({ year: 2026, month: 11, day: 12 });
    expect(parseDhakaDate("2026-02-30")).toBeNull();
    expect(parseDhakaDate("2026-2-3")).toBeNull();
    expect(formatDhakaDate({ year: 2026, month: 1, day: 5 })).toBe("2026-01-05");
  });

  it("starts a Dhaka day six hours before UTC midnight", () => {
    expect(startOfDhakaDay({ year: 2026, month: 11, day: 12 })).toBe(Date.UTC(2026, 10, 11, 18));
  });
});
