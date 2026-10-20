import { describe, expect, it } from "vite-plus/test";
import {
  dhakaDayLetter,
  joinDays,
  overlaps,
  overlapsWith,
  parseDays,
  timeToMinutes,
  todayEntries,
  type RoutineDay,
} from "./routine";

const slot = (id: number, days: RoutineDay[], start: string, end: string) => ({
  id,
  days,
  start,
  end,
});

describe("overlaps", () => {
  it("flags two classes on the same day whose times cross", () => {
    const a = slot(1, ["M", "W"], "09:00", "10:30");
    const b = slot(2, ["W"], "10:00", "11:30");
    expect(overlaps([a, b])).toEqual([[1, 2]]);
  });

  it("does not flag a class that starts exactly when another ends, or ends when another starts", () => {
    const first = slot(1, ["M"], "08:00", "09:30");
    const second = slot(2, ["M"], "09:30", "11:00");
    const before = slot(3, ["M"], "07:00", "08:00");
    expect(overlaps([first, second, before])).toEqual([]);
  });

  it("does not flag the same time on different days", () => {
    expect(
      overlaps([slot(1, ["M", "W"], "09:00", "10:30"), slot(2, ["T", "R"], "09:00", "10:30")]),
    ).toEqual([]);
  });

  it("flags a class that sits inside another", () => {
    expect(overlaps([slot(1, ["S"], "09:00", "12:00"), slot(2, ["S"], "10:00", "11:00")])).toEqual([
      [1, 2],
    ]);
  });

  it("lists each pair once, lower id first, whatever the order", () => {
    const all = [
      slot(5, ["F"], "09:00", "10:00"),
      slot(2, ["F"], "09:30", "10:30"),
      slot(9, ["F"], "09:45", "11:00"),
    ];
    expect(overlaps(all)).toEqual([
      [2, 5],
      [5, 9],
      [2, 9],
    ]);
  });

  it("overlapsWith ignores the entry itself and names only the clashing ones", () => {
    const mine = slot(1, ["M"], "09:00", "10:00");
    const others = [mine, slot(2, ["M"], "09:30", "10:30"), slot(3, ["T"], "09:30", "10:30")];
    expect(overlapsWith(mine, others)).toEqual([2]);
  });
});

describe("today", () => {
  it("is the Asia/Dhaka weekday, which changes six hours before UTC does", () => {
    // 2026-10-20 is a Tuesday in UTC. 18:00 UTC is already midnight Wednesday in Dhaka.
    expect(dhakaDayLetter(Date.UTC(2026, 9, 20, 17, 59))).toBe("T");
    expect(dhakaDayLetter(Date.UTC(2026, 9, 20, 18, 0))).toBe("W");
  });

  it("maps every weekday to its NSU letter, Sunday first", () => {
    const letters = [0, 1, 2, 3, 4, 5, 6].map((i) => dhakaDayLetter(Date.UTC(2026, 9, 18 + i, 6)));
    expect(letters).toEqual(["S", "M", "T", "W", "R", "F", "A"]);
  });

  it("lists only today's classes, earliest first, across UTC midnight", () => {
    const entries = [
      slot(1, ["W"], "14:00", "15:30"),
      slot(2, ["M", "W"], "08:00", "09:30"),
      slot(3, ["T"], "07:00", "08:00"),
      slot(4, ["W"], "08:00", "09:00"),
    ];
    // 20:00 UTC on Tuesday is 02:00 on Wednesday in Dhaka.
    const now = Date.UTC(2026, 9, 20, 20, 0);
    expect(todayEntries(entries, now).map((e) => e.id)).toEqual([4, 2, 1]);
    // Still Tuesday in Dhaka an hour before.
    expect(todayEntries(entries, Date.UTC(2026, 9, 20, 17, 0)).map((e) => e.id)).toEqual([3]);
  });
});

describe("helpers", () => {
  it("keeps days in week order", () => {
    expect(joinDays(["W", "S", "M"])).toBe("SMW");
    expect(parseDays("RT")).toEqual(["T", "R"]);
  });

  it("reads HH:MM and refuses anything else", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("9:30")).toBe(570);
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("10:60")).toBeNull();
    expect(timeToMinutes("noon")).toBeNull();
  });
});
