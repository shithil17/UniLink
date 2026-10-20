import { describe, expect, it } from "vite-plus/test";
import type { Attempt } from "../../shared/schemas/attempts";
import {
  attemptTermLabel,
  categoriesLeft,
  facultyOptions,
  formatCgpa,
  retakeCodes,
  retakeStatus,
} from "./attempts";

const attempt = (id: number, courseCode: string, grade: Attempt["grade"]): Attempt => ({
  id,
  courseCode,
  grade,
  term: null,
  facultyId: null,
  createdAt: id,
});

describe("formatCgpa", () => {
  it("prints two decimals and a dash while there is no CGPA", () => {
    expect(formatCgpa(3.4567)).toBe("3.46");
    expect(formatCgpa(4)).toBe("4.00");
    expect(formatCgpa(0)).toBe("0.00");
    expect(formatCgpa(null)).toBe("–");
  });
});

describe("retake state", () => {
  const all = [
    attempt(1, "CSE115", "C"),
    attempt(2, "CSE173", "B+"),
    attempt(3, "MAT120", "F"),
    attempt(4, "MAT120", "B"),
    attempt(5, "ENG102", "W"),
  ];

  it("lists the codes that may be retaken: best below B+, W never blocks", () => {
    expect([...retakeCodes(all)].sort()).toEqual(["CSE115", "ENG102", "MAT120"]);
  });

  it("blocks from B+ and says why, naming the best grade", () => {
    const blocked = retakeStatus(all, "CSE173");
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain("best grade for CSE173 is B+");
    expect(retakeStatus(all, "CSE115")).toEqual({ allowed: true, reason: null });
    expect(retakeStatus(all, "NEVER1").allowed).toBe(true);
  });
});

describe("categoriesLeft", () => {
  it("keeps only the categories that still need credits", () => {
    const c = (name: string, remaining: number) => ({ name, required: 9, earned: 9, remaining });
    expect(categoriesLeft({ categories: [c("Core", 0), c("Math", 6)] }).map((x) => x.name)).toEqual(
      ["Math"],
    );
  });
});

describe("faculty and term labels", () => {
  it("starts the faculty options with a none choice and shows name and designation", () => {
    const options = facultyOptions([
      { id: 7, name: "Amy Ay", initials: "AA", designation: "Lecturer" },
    ]);
    expect(options[0]).toEqual({ value: "none", label: "No faculty" });
    expect(options[1]).toEqual({ value: "7", label: "Amy Ay, Lecturer" });
  });

  it("labels an attempt without a term", () => {
    expect(attemptTermLabel(null)).toBe("Term not set");
    expect(attemptTermLabel({ year: 2025, season: "fall" })).toBe("Fall 2025");
  });
});
