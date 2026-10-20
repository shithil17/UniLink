import { describe, expect, it } from "vite-plus/test";
import type { CourseMap } from "../../shared/schemas/courses";
import type { RoutineEntry } from "../../shared/schemas/routine";
import {
  classDetails,
  clashesFor,
  formatClock,
  formatGap,
  formatRange,
  nextClassOf,
  routineCourseChoices,
  weekDays,
} from "./routine";

const entry = (over: Partial<RoutineEntry> & Pick<RoutineEntry, "id" | "days">): RoutineEntry => ({
  term: { year: 2026, season: "fall" },
  courseCode: "CSE115",
  section: 1,
  start: "09:00",
  end: "10:30",
  room: "",
  initials: "",
  ...over,
});

describe("time formatting", () => {
  it("prints 12-hour clock times with noon and midnight right", () => {
    expect(formatClock("00:05")).toBe("12:05 AM");
    expect(formatClock("09:30")).toBe("9:30 AM");
    expect(formatClock("12:00")).toBe("12:00 PM");
    expect(formatClock("14:30")).toBe("2:30 PM");
  });

  it("writes AM/PM once when a range stays inside one half of the day", () => {
    expect(formatRange("09:30", "10:45")).toBe("9:30 - 10:45 AM");
    expect(formatRange("11:30", "13:00")).toBe("11:30 AM - 1:00 PM");
  });

  it("rounds a gap in minutes into min and h", () => {
    expect(formatGap(12)).toBe("12 min");
    expect(formatGap(60)).toBe("1 h");
    expect(formatGap(65)).toBe("1 h 5 min");
    expect(formatGap(-3)).toBe("0 min");
  });
});

describe("classDetails", () => {
  it("leaves out the room and faculty when they were not entered", () => {
    expect(classDetails({ section: 2, room: "", initials: "" })).toBe("Section 2");
    expect(classDetails({ section: 2, room: "NAC 304", initials: "RkZ" })).toBe(
      "Section 2 · Room NAC 304 · RkZ",
    );
  });
});

describe("weekDays", () => {
  it("lists all seven days in week order, empty ones with no entries", () => {
    const week = weekDays([entry({ id: 1, days: ["M", "W"] })]);
    expect(week.map((d) => d.day)).toEqual(["S", "M", "T", "W", "R", "F", "A"]);
    expect(week.map((d) => d.entries.length)).toEqual([0, 1, 0, 1, 0, 0, 0]);
  });

  it("marks a clash only on the day the two classes share", () => {
    const a = entry({ id: 1, days: ["M", "W"], start: "09:00", end: "10:30" });
    const b = entry({
      id: 2,
      days: ["W", "R"],
      start: "10:00",
      end: "11:00",
      courseCode: "MAT120",
    });
    const week = weekDays([a, b]);
    expect(week[1].clashes.size).toBe(0);
    expect(week[3].clashes.get(1)?.map((e) => e.id)).toEqual([2]);
    expect(week[4].clashes.size).toBe(0);
  });
});

describe("clashesFor", () => {
  const saved = [entry({ id: 1, days: ["M"], start: "09:00", end: "10:30" })];

  it("names the saved class a draft would clash with", () => {
    const hit = clashesFor({ id: 0, days: ["M"], start: "10:00", end: "11:00" }, saved);
    expect(hit.map((e) => e.id)).toEqual([1]);
  });

  it("ignores back-to-back classes, other days and the entry being edited", () => {
    expect(clashesFor({ id: 0, days: ["M"], start: "10:30", end: "12:00" }, saved)).toEqual([]);
    expect(clashesFor({ id: 0, days: ["T"], start: "09:00", end: "10:30" }, saved)).toEqual([]);
    expect(clashesFor({ id: 1, days: ["M"], start: "09:00", end: "10:30" }, saved)).toEqual([]);
  });

  it("stays quiet until the draft has days and a start before its end", () => {
    expect(clashesFor({ id: 0, days: [], start: "09:00", end: "10:30" }, saved)).toEqual([]);
    expect(clashesFor({ id: 0, days: ["M"], start: "", end: "10:30" }, saved)).toEqual([]);
    expect(clashesFor({ id: 0, days: ["M"], start: "11:00", end: "10:00" }, saved)).toEqual([]);
  });
});

describe("nextClassOf", () => {
  // 2026-10-20 is a Tuesday. 03:00 UTC is 09:00 in Dhaka.
  const nine = Date.UTC(2026, 9, 20, 3, 0);
  const entries = [
    entry({ id: 1, days: ["T"], start: "08:00", end: "09:30" }),
    entry({ id: 2, days: ["T"], start: "11:00", end: "12:00" }),
    entry({ id: 3, days: ["M"], start: "09:00", end: "10:00" }),
  ];

  it("is the class in progress in Dhaka, then the next one, and null when none is left", () => {
    expect(nextClassOf(entries, nine)?.id).toBe(1);
    expect(nextClassOf(entries, Date.UTC(2026, 9, 20, 4, 0))?.id).toBe(2);
    expect(nextClassOf(entries, Date.UTC(2026, 9, 20, 7, 0))).toBeNull();
    expect(nextClassOf(undefined, nine)).toBeNull();
    expect(nextClassOf([], nine)).toBeNull();
  });
});

describe("routineCourseChoices", () => {
  type Slot = CourseMap["categories"][number]["slots"][number];
  const slot = (over: Partial<Slot>): Slot => ({
    kind: "course",
    code: "CSE115",
    title: "Programming",
    credits: 3,
    category: "Core",
    nonCredit: false,
    semester: 1,
    alternatives: [],
    prereq: null,
    status: "available",
    filledBy: null,
    chosenCode: null,
    waived: false,
    studentCourse: null,
    ...over,
  });

  it("offers slot codes, their alternatives and the student's own courses, once each, by code", () => {
    const own = { code: "BUS101", title: "Intro to Business" } as CourseMap["extras"][number];
    const choices = routineCourseChoices({
      categories: [
        {
          name: "Core",
          required: 0,
          earned: 0,
          slots: [
            slot({ alternatives: [{ code: "ENG115", title: "English" }] }),
            slot({ kind: "elective", code: "ELEC1", title: "Elective", studentCourse: own }),
            slot({ code: "CSE115" }),
          ],
        },
      ],
      extras: [own],
    });
    expect(choices.map((c) => c.code)).toEqual(["BUS101", "CSE115", "ENG115"]);
  });
});
