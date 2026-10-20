import { describe, expect, it } from "vite-plus/test";
import type { RoutineEntry } from "../../shared/schemas/routine";
import {
  classesOn,
  gridHours,
  hourLabel,
  periodLabel,
  placeDay,
  statusOn,
  stepDate,
} from "./routineCalendar";

const entry = (
  id: number,
  start: string,
  end: string,
  days: RoutineEntry["days"] = ["S", "T"],
): RoutineEntry => ({
  id,
  term: { year: 2026, season: "fall" },
  courseCode: `CSE${100 + id}`,
  section: 1,
  days,
  start,
  end,
  room: "",
  initials: "",
});

const fall = { start: "2026-09-01", end: "2027-01-01" };

describe("classesOn", () => {
  it("lists a date's classes from its weekday, in time order", () => {
    const entries = [
      entry(1, "11:20", "12:50"),
      entry(2, "08:00", "09:30"),
      entry(3, "08:00", "09:30", ["M"]),
    ];
    // 2026-10-20 is a Tuesday.
    expect(classesOn(entries, "2026-10-20", fall).map((e) => e.id)).toEqual([2, 1]);
    expect(classesOn(entries, "2026-10-19", fall).map((e) => e.id)).toEqual([3]);
    // Friday: nothing.
    expect(classesOn(entries, "2026-10-23", fall)).toEqual([]);
  });

  it("shows nothing outside the term", () => {
    const entries = [entry(1, "08:00", "09:30")];
    // 2026-08-30 is a Sunday, before Fall starts; 2027-01-03 a Sunday after it ends.
    expect(classesOn(entries, "2026-08-30", fall)).toEqual([]);
    expect(classesOn(entries, "2027-01-03", fall)).toEqual([]);
    expect(classesOn(entries, "2026-09-06", fall)).toHaveLength(1);
  });
});

describe("statusOn", () => {
  // 2026-10-20 10:00 in Dhaka is 04:00 UTC.
  const now = Date.UTC(2026, 9, 20, 4, 0);
  it("marks earlier dates done and later ones upcoming", () => {
    const e = entry(1, "08:00", "09:30");
    expect(statusOn(e, "2026-10-18", "2026-10-20", now)).toBe("done");
    expect(statusOn(e, "2026-10-25", "2026-10-20", now)).toBe("upcoming");
  });

  it("uses the clock today", () => {
    expect(statusOn(entry(1, "08:00", "09:30"), "2026-10-20", "2026-10-20", now)).toBe("done");
    expect(statusOn(entry(2, "09:40", "11:10"), "2026-10-20", "2026-10-20", now)).toBe("current");
    expect(statusOn(entry(3, "11:20", "12:50"), "2026-10-20", "2026-10-20", now)).toBe("upcoming");
  });
});

describe("gridHours", () => {
  it("shows the teaching day, widened to fit early or late classes", () => {
    expect(gridHours([])).toEqual({ start: 8, end: 18 });
    expect(gridHours([entry(1, "07:30", "09:00"), entry(2, "18:10", "19:40")])).toEqual({
      start: 7,
      end: 20,
    });
  });
});

describe("placeDay", () => {
  const lanes = (placed: ReturnType<typeof placeDay>) =>
    placed.map((p) => [p.entry.id, p.lane, p.lanes]);

  it("gives classes that do not clash the full width", () => {
    expect(lanes(placeDay([entry(2, "09:40", "11:10"), entry(1, "08:00", "09:40")]))).toEqual([
      [1, 0, 1],
      [2, 0, 1],
    ]);
  });

  it("puts clashing classes side by side and reuses a lane once it is free", () => {
    // 1 and 2 clash; 3 clashes with 2 only, so it takes lane 0 again. All three share two lanes.
    const placed = placeDay([
      entry(1, "08:00", "09:30"),
      entry(2, "09:00", "10:30"),
      entry(3, "09:30", "11:00"),
      entry(4, "13:00", "14:30"),
    ]);
    expect(lanes(placed)).toEqual([
      [1, 0, 2],
      [2, 1, 2],
      [3, 0, 2],
      [4, 0, 1],
    ]);
  });

  it("opens a third lane when three classes clash at once", () => {
    const placed = placeDay([
      entry(1, "08:00", "10:00"),
      entry(2, "08:30", "10:00"),
      entry(3, "09:00", "10:00"),
    ]);
    expect(lanes(placed)).toEqual([
      [1, 0, 3],
      [2, 1, 3],
      [3, 2, 3],
    ]);
  });
});

describe("navigation and labels", () => {
  it("steps by a month, a week or a day", () => {
    expect(stepDate("month", "2026-10-21", 1)).toBe("2026-11-21");
    expect(stepDate("week", "2026-10-21", -1)).toBe("2026-10-14");
    expect(stepDate("day", "2026-10-31", 1)).toBe("2026-11-01");
  });

  it("names the period on screen", () => {
    expect(periodLabel("month", "2026-10-21")).toBe("October 2026");
    expect(periodLabel("week", "2026-10-21")).toBe("Oct 18 - 24");
    expect(periodLabel("week", "2026-10-28")).toBe("Oct 25 - 31");
    expect(periodLabel("week", "2026-09-29")).toBe("Sep 27 - Oct 3");
    expect(periodLabel("week", "2026-11-01")).toBe("Nov 1 - 7");
    expect(periodLabel("week", "2026-12-30")).toBe("Dec 27 - Jan 2");
    expect(periodLabel("day", "2026-10-21")).toBe("Wednesday, Oct 21");
  });

  it("labels hours the way the routine prints times", () => {
    expect([8, 11, 12, 13, 0].map(hourLabel)).toEqual(["8 AM", "11 AM", "12 PM", "1 PM", "12 AM"]);
  });
});
