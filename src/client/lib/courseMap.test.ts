import { describe, expect, it } from "vite-plus/test";
import {
  categoryAnchor,
  progressPercent,
  defaultElectiveCategory,
  describePrereq,
  formatTotals,
  isNonCreditCategory,
  overNote,
  trailProgressLine,
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

describe("progress and anchors", () => {
  it("fills the bar up to 100 and never past it", () => {
    expect(progressPercent(0, 30)).toBe(0);
    expect(progressPercent(15, 30)).toBe(50);
    expect(progressPercent(36, 30)).toBe(100);
    expect(progressPercent(0, 0)).toBe(0);
  });

  it("turns a category name into a valid id", () => {
    expect(categoryAnchor("Math & Science")).toBe("cat-math-science");
    expect(categoryAnchor("Major Core (by major)")).toBe("cat-major-core-by-major");
  });
});

describe("trailProgressLine", () => {
  const trail = (name: string, done: number, added: number) => ({
    name,
    done,
    added,
    courses: [],
  });
  const base = { minFromOneTrail: 2, trails: [trail("Networks", 0, 1), trail("AI", 1, 1)] };

  it("states the rule while no trail has a done course", () => {
    expect(trailProgressLine({ ...base, met: false, leading: null })).toBe(
      "Take at least 2 from one trail",
    );
  });

  it("shows the leading trail with its done and added counts", () => {
    expect(trailProgressLine({ ...base, met: false, leading: "AI" })).toBe(
      "AI: 1 of 2 done, 1 added",
    );
    expect(
      trailProgressLine({ ...base, trails: [trail("AI", 1, 0)], met: false, leading: "AI" }),
    ).toBe("AI: 1 of 2 done");
  });

  it("says the trail is met, and never prints 3 of 2", () => {
    const met = (done: number) =>
      trailProgressLine({ ...base, trails: [trail("AI", done, 0)], met: true, leading: "AI" });
    expect(met(2)).toBe("Trail met: AI (2 of 2 done)");
    expect(met(3)).toBe("Trail met: AI (3 done)");
  });
});

describe("isNonCreditCategory", () => {
  const cat = (required: number, nonCredit: boolean[]) =>
    ({
      name: "Internship",
      required,
      earned: 0,
      slots: nonCredit.map((n) => ({ nonCredit: n })),
      trails: null,
    }) as unknown as CourseMap["categories"][number];

  it("is true only when nothing is required and every slot is non-credit", () => {
    expect(isNonCreditCategory(cat(0, [true]))).toBe(true);
    expect(isNonCreditCategory(cat(0, [true, false]))).toBe(false);
    expect(isNonCreditCategory(cat(3, [true]))).toBe(false);
    expect(isNonCreditCategory(cat(0, []))).toBe(false);
  });
});
