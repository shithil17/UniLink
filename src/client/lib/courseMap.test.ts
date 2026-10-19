import { describe, expect, it } from "vite-plus/test";
import {
  defaultElectiveCategory,
  describePrereq,
  formatTotals,
  overNote,
  termOptions,
} from "./courseMap";
import type { CourseMap } from "../../shared/schemas/courses";

describe("describePrereq", () => {
  it("reads a course leaf and a credits leaf", () => {
    expect(describePrereq({ course: "CSE115" })).toBe("CSE115");
    expect(describePrereq({ credits: 60 })).toBe("60 credits completed");
  });

  it("joins all with and, any with or, and brackets nested groups", () => {
    expect(
      describePrereq({
        all: [{ course: "CSE115" }, { any: [{ course: "MAT120" }, { course: "MAT125" }] }],
      }),
    ).toBe("CSE115 and (MAT120 or MAT125)");
    expect(describePrereq({ any: [{ course: "ENG102" }, { credits: 90 }] })).toBe(
      "ENG102 or 90 credits completed",
    );
  });

  it("collapses single-child and empty groups, and says nothing without a rule", () => {
    expect(describePrereq({ all: [{ course: "CSE115" }] })).toBe("CSE115");
    expect(describePrereq({ all: [] })).toBeNull();
    expect(describePrereq(null)).toBeNull();
  });
});

describe("credit totals", () => {
  it("shows an over-total plainly with an over-by note", () => {
    expect(formatTotals(136, 130)).toBe("136 / 130");
    expect(overNote(136, 130)).toBe("over by 6");
    expect(overNote(130, 130)).toBeNull();
    expect(overNote(12.5, 12)).toBe("over by 0.5");
    expect(formatTotals(1.5, 130)).toBe("1.5 / 130");
  });
});

describe("termOptions", () => {
  it("lists the current term first and steps back one term at a time across years", () => {
    // 2026-10-19 is in Fall 2026 (Asia/Dhaka).
    const terms = termOptions(Date.UTC(2026, 9, 19));
    expect(terms.slice(0, 4)).toEqual([
      { year: 2026, season: "fall" },
      { year: 2026, season: "summer" },
      { year: 2026, season: "spring" },
      { year: 2025, season: "fall" },
    ]);
  });
});

describe("defaultElectiveCategory", () => {
  it("picks the first category that has an elective slot", () => {
    const slot = (kind: "course" | "elective") =>
      ({ kind }) as CourseMap["categories"][number]["slots"][number];
    const map = {
      categories: [
        { name: "Core", slots: [slot("course")] },
        { name: "Electives", slots: [slot("elective")] },
      ],
    } as CourseMap;
    expect(defaultElectiveCategory(map)).toBe("Electives");
  });
});
