import { describe, expect, it } from "vite-plus/test";
import type { CourseMap } from "../../shared/schemas/courses";
import {
  dhakaDateLine,
  greeting,
  greetingBand,
  selectHomeState,
  unlockedNext,
  UNLOCKED_NEXT_MAX,
} from "./home";

const ok = <T>(data: T) => ({ status: "success" as const, data });
const pending = { status: "pending" as const, data: undefined };
const failed = { status: "error" as const, data: undefined };
const user = { username: "sam" };
const mapWith = (curriculum: object | null) => ok({ curriculum } as Pick<CourseMap, "curriculum">);

describe("selectHomeState", () => {
  it("shows loading while the session check runs", () => {
    expect(selectHomeState(pending, pending)).toBe("loading");
  });

  it("shows the error state when the session check fails (not a 401)", () => {
    expect(selectHomeState(failed, pending)).toBe("error");
  });

  it("is signed out only when the session resolved to null", () => {
    expect(selectHomeState(ok(null), pending)).toBe("signedOut");
  });

  it("waits for the course map, then reports its failure", () => {
    expect(selectHomeState(ok(user), pending)).toBe("loading");
    expect(selectHomeState(ok(user), failed)).toBe("error");
  });

  it("is empty without a curriculum and ready with one", () => {
    expect(selectHomeState(ok(user), mapWith(null))).toBe("empty");
    expect(selectHomeState(ok(user), mapWith({ id: 1 }))).toBe("ready");
  });
});

const slot = (code: string, over: Partial<CourseMap["categories"][number]["slots"][number]> = {}) =>
  ({
    kind: "course",
    code,
    title: code,
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
  }) as CourseMap["categories"][number]["slots"][number];

const category = (slots: ReturnType<typeof slot>[]) => ({
  name: "Core",
  required: 0,
  earned: 0,
  slots,
  trails: null,
});

describe("unlockedNext", () => {
  it("keeps only available fixed courses, earliest semester first, no semester last", () => {
    const { items, total } = unlockedNext({
      categories: [
        category([
          slot("C", { semester: null }),
          slot("B", { semester: 3 }),
          slot("DONE", { status: "done" }),
          slot("LOCK", { status: "locked" }),
          slot("ELECT1", { kind: "elective" }),
          slot("A", { semester: 2 }),
          slot("A2", { semester: 2 }),
        ]),
      ],
    });
    expect(items.map((s) => s.code)).toEqual(["A", "A2", "B", "C"]);
    expect(total).toBe(4);
  });

  it("caps the list but still reports the full count", () => {
    const many = Array.from({ length: UNLOCKED_NEXT_MAX + 3 }, (_, i) => slot(`X${i}`));
    const { items, total } = unlockedNext({ categories: [category(many)] });
    expect(items).toHaveLength(UNLOCKED_NEXT_MAX);
    expect(total).toBe(UNLOCKED_NEXT_MAX + 3);
  });
});

// Dhaka is UTC+6, so 04:59 in Dhaka is 22:59 UTC the day before. Building the instants in UTC makes
// these fail if the band is read in the device's zone or in UTC.
const dhakaAt = (hour: number, minute: number) => Date.UTC(2026, 9, 24, hour - 6, minute);

describe("greetingBand", () => {
  it.each([
    ["04:59", 4, 59, "evening"],
    ["05:00", 5, 0, "morning"],
    ["11:59", 11, 59, "morning"],
    ["12:00", 12, 0, "afternoon"],
    ["16:59", 16, 59, "afternoon"],
    ["17:00", 17, 0, "evening"],
  ] as const)("is %s Dhaka -> %s", (_label, hour, minute, band) => {
    expect(greetingBand(dhakaAt(hour, minute))).toBe(band);
  });

  it("reads the Dhaka hour, not the UTC hour", () => {
    // 23:00 UTC is 05:00 the next day in Dhaka.
    expect(greetingBand(Date.UTC(2026, 9, 23, 23, 0))).toBe("morning");
  });
});

describe("greeting", () => {
  it("names the user when there is a name", () => {
    expect(greeting(dhakaAt(9, 0), "apollo")).toBe("Good morning, apollo");
  });

  it("has no name when none is available", () => {
    expect(greeting(dhakaAt(13, 0))).toBe("Good afternoon");
    expect(greeting(dhakaAt(19, 0), null)).toBe("Good evening");
    expect(greeting(dhakaAt(19, 0), "  ")).toBe("Good evening");
  });
});

describe("dhakaDateLine", () => {
  it("prints the Dhaka calendar day", () => {
    // 20:00 UTC on Friday 23 October is already Saturday 24 October in Dhaka.
    expect(dhakaDateLine(Date.UTC(2026, 9, 23, 20, 0))).toBe("Saturday, 24 October");
  });
});
