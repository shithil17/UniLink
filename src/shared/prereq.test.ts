import { describe, expect, it } from "vite-plus/test";
import { isPrereqMet, passedCodes, prereqCourseCodes, type PrereqRule } from "./prereq";

const state = (codes: string[] = [], earnedCredits = 0) => ({
  passed: new Set(codes),
  earnedCredits,
});

describe("isPrereqMet", () => {
  it("a course leaf needs that code passed", () => {
    expect(isPrereqMet({ course: "CSE115" }, state(["CSE115"]))).toBe(true);
    expect(isPrereqMet({ course: "CSE115" }, state(["CSE173"]))).toBe(false);
  });

  it("treats no rule and empty groups as met", () => {
    expect(isPrereqMet(null, state())).toBe(true);
    expect(isPrereqMet(undefined, state())).toBe(true);
    expect(isPrereqMet({ all: [] }, state())).toBe(true);
    expect(isPrereqMet({ any: [] }, state())).toBe(true);
  });

  it("all needs every child, any needs one", () => {
    const all: PrereqRule = { all: [{ course: "A101" }, { course: "B101" }] };
    const any: PrereqRule = { any: [{ course: "A101" }, { course: "B101" }] };
    expect(isPrereqMet(all, state(["A101"]))).toBe(false);
    expect(isPrereqMet(all, state(["A101", "B101"]))).toBe(true);
    expect(isPrereqMet(any, state())).toBe(false);
    expect(isPrereqMet(any, state(["B101"]))).toBe(true);
  });

  it("evaluates nested groups", () => {
    const rule: PrereqRule = {
      all: [
        { course: "A101" },
        { any: [{ course: "B101" }, { all: [{ course: "C101" }, { credits: 60 }] }] },
      ],
    };
    expect(isPrereqMet(rule, state(["A101", "B101"]))).toBe(true);
    expect(isPrereqMet(rule, state(["A101", "C101"], 59.5))).toBe(false);
    expect(isPrereqMet(rule, state(["A101", "C101"], 60))).toBe(true);
    expect(isPrereqMet(rule, state(["B101"]))).toBe(false);
  });

  it("a credits leaf needs at least that many earned credits", () => {
    expect(isPrereqMet({ credits: 90 }, state([], 89))).toBe(false);
    expect(isPrereqMet({ credits: 90 }, state([], 90))).toBe(true);
    expect(isPrereqMet({ credits: 90 }, state([], 136))).toBe(true);
  });
});

describe("passedCodes", () => {
  it("F, I and W do not satisfy a prerequisite, any other grade does", () => {
    for (const grade of ["F", "I", "W"]) {
      const passed = passedCodes([{ courseCode: "CSE115", grade }]);
      expect(isPrereqMet({ course: "CSE115" }, { passed, earnedCredits: 0 })).toBe(false);
    }
    for (const grade of ["A", "D", "D+", "C-"]) {
      const passed = passedCodes([{ courseCode: "CSE115", grade }]);
      expect(isPrereqMet({ course: "CSE115" }, { passed, earnedCredits: 0 })).toBe(true);
    }
  });

  it("a later pass counts after an earlier fail", () => {
    const passed = passedCodes([
      { courseCode: "CSE115", grade: "F" },
      { courseCode: "CSE115", grade: "B" },
    ]);
    expect(passed.has("CSE115")).toBe(true);
  });
});

describe("prereqCourseCodes", () => {
  it("lists course leaves and skips credits leaves", () => {
    expect(
      prereqCourseCodes({
        all: [{ course: "A101" }, { any: [{ course: "B101" }, { credits: 9 }] }],
      }),
    ).toEqual(["A101", "B101"]);
    expect(prereqCourseCodes(null)).toEqual([]);
  });
});
