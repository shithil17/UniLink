import { describe, expect, it } from "vite-plus/test";
import {
  addDays,
  addMonths,
  dhakaToday,
  inRange,
  isDateKey,
  monthWeeks,
  startOfWeek,
  weekdayOf,
  weekOf,
} from "./calendar";

describe("calendar dates", () => {
  it("takes today from the Dhaka clock, which turns six hours before UTC", () => {
    expect(dhakaToday(Date.UTC(2026, 9, 20, 17, 59))).toBe("2026-10-20");
    expect(dhakaToday(Date.UTC(2026, 9, 20, 18, 0))).toBe("2026-10-21");
  });

  it("refuses dates that do not exist", () => {
    expect(isDateKey("2026-10-21")).toBe(true);
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2028-02-29")).toBe(true);
    expect(isDateKey("2026-13-01")).toBe(false);
    expect(isDateKey("21-10-2026")).toBe(false);
    expect(isDateKey(20261021)).toBe(false);
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("starts the week on Sunday", () => {
    expect(weekdayOf("2026-10-18")).toBe(0);
    expect(weekdayOf("2026-10-24")).toBe(6);
    expect(startOfWeek("2026-10-21")).toBe("2026-10-18");
    expect(startOfWeek("2026-10-18")).toBe("2026-10-18");
    expect(weekOf("2026-10-21")).toEqual([
      "2026-10-18",
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
    ]);
  });

  it("moves by months, keeping the day where the month has it", () => {
    expect(addMonths("2026-10-21", 1)).toBe("2026-11-21");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
  });

  it("covers a month with whole weeks", () => {
    // October 2026 starts on a Thursday and ends on a Saturday: five weeks.
    const october = monthWeeks("2026-10-21");
    expect(october).toHaveLength(5);
    expect(october[0][0]).toBe("2026-09-27");
    expect(october[4][6]).toBe("2026-10-31");
    // February 2026 starts on a Sunday and fills exactly four weeks.
    const february = monthWeeks("2026-02-10");
    expect(february).toHaveLength(4);
    expect(february[0][0]).toBe("2026-02-01");
    expect(february[3][6]).toBe("2026-02-28");
    // August 2026 starts on a Saturday: six weeks.
    expect(monthWeeks("2026-08-01")).toHaveLength(6);
  });

  it("treats a range as including its start and excluding its end", () => {
    const range = { start: "2026-09-01", end: "2027-01-01" };
    expect(inRange("2026-09-01", range)).toBe(true);
    expect(inRange("2026-12-31", range)).toBe(true);
    expect(inRange("2027-01-01", range)).toBe(false);
    expect(inRange("2026-08-31", range)).toBe(false);
  });
});
