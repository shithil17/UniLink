import { describe, expect, it } from "vite-plus/test";
import { countsInCgpa, gradeLabel, isPassingGrade, WAIVED } from "./grading";

describe("grading", () => {
  it("a waiver passes but stays out of CGPA", () => {
    expect(isPassingGrade(WAIVED)).toBe(true);
    expect(countsInCgpa(WAIVED)).toBe(false);
    expect(gradeLabel(WAIVED)).toBe("Waived");
  });

  it("F counts in CGPA without passing; I and W do neither", () => {
    expect([isPassingGrade("F"), countsInCgpa("F")]).toEqual([false, true]);
    for (const g of ["I", "W"])
      expect([isPassingGrade(g), countsInCgpa(g)]).toEqual([false, false]);
    expect([isPassingGrade("A"), countsInCgpa("A")]).toEqual([true, true]);
  });
});
