import { describe, expect, it } from "vite-plus/test";
import {
  bestAttempt,
  canRetake,
  cgpa,
  countsInCgpa,
  earnedCredits,
  gradedCredits,
  gradeLabel,
  gradePoints,
  isPassingGrade,
  NSU_SCALE,
  WAIVED,
  type CourseRecord,
  type RetakePolicy,
} from "./grading";

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

const grades = (...list: string[]) => list.map((grade) => ({ grade }));
const course = (
  credits: number,
  list: string[],
  extra: Partial<CourseRecord> = {},
): CourseRecord => ({
  credits,
  attempts: grades(...list),
  ...extra,
});

describe("grade points", () => {
  it("follows the NSU scale for every letter", () => {
    const expected = {
      A: 4.0,
      "A-": 3.7,
      "B+": 3.3,
      B: 3.0,
      "B-": 2.7,
      "C+": 2.3,
      C: 2.0,
      "C-": 1.7,
      "D+": 1.3,
      D: 1.0,
      F: 0.0,
    };
    for (const [grade, points] of Object.entries(expected)) {
      expect(gradePoints(grade)).toBe(points);
    }
    expect(Object.keys(NSU_SCALE.points)).toHaveLength(Object.keys(expected).length);
  });

  it("gives I, W and a waiver no points", () => {
    for (const grade of ["I", "W", WAIVED]) expect(gradePoints(grade)).toBeNull();
  });
});

describe("bestAttempt", () => {
  it("is the highest of several attempts, the earliest on a tie", () => {
    const list = [
      { id: 1, grade: "C" },
      { id: 2, grade: "B+" },
      { id: 3, grade: "B+" },
      { id: 4, grade: "B" },
    ];
    expect(bestAttempt(list)?.id).toBe(2);
  });

  it("takes a pass over an earlier F, and an F when it is all there is", () => {
    expect(bestAttempt(grades("F", "D"))?.grade).toBe("D");
    expect(bestAttempt(grades("F", "F"))?.grade).toBe("F");
  });

  it("ignores I, W and a waiver, and is null with nothing else", () => {
    expect(bestAttempt(grades("I", "W", WAIVED))).toBeNull();
    expect(bestAttempt(grades("W", "C-", "I"))?.grade).toBe("C-");
    expect(bestAttempt([])).toBeNull();
  });
});

describe("cgpa", () => {
  it("weights each course's best grade by its credits", () => {
    // (4.0 * 3 + 3.0 * 3 + 2.0 * 1.5) / 7.5 = 3.2
    expect(cgpa([course(3, ["A"]), course(3, ["B"]), course(1.5, ["C"])])).toBeCloseTo(3.2);
  });

  it("counts the best of several attempts once", () => {
    expect(cgpa([course(3, ["F", "C", "B"]), course(3, ["A"])])).toBeCloseTo(3.5);
  });

  it("counts an F as 0.0 but not as an earned credit", () => {
    const f = [course(3, ["F"]), course(3, ["A"])];
    expect(cgpa(f)).toBeCloseTo(2.0);
    expect(earnedCredits(f)).toBe(3);
  });

  it("is null when only I and W (or nothing) were recorded", () => {
    expect(cgpa([course(3, ["I"]), course(3, ["W", "W"])])).toBeNull();
    expect(cgpa([])).toBeNull();
    expect(earnedCredits([course(3, ["I"]), course(3, ["W"])])).toBe(0);
  });

  it("a waived course earns credits but never touches CGPA", () => {
    const waived = course(3, [WAIVED]);
    expect(cgpa([waived])).toBeNull();
    expect(earnedCredits([waived])).toBe(3);
    expect(cgpa([waived, course(3, ["B"])])).toBeCloseTo(3.0);
    // A later graded attempt replaces the waiver in CGPA and still earns the credits once.
    const both = course(3, [WAIVED, "C"]);
    expect(cgpa([both])).toBeCloseTo(2.0);
    expect(earnedCredits([both])).toBe(3);
  });

  it("leaves non-credit and excluded courses out of CGPA, graded credits and earned credits", () => {
    const list = [
      course(0, ["F"], { nonCredit: true }),
      course(3, ["A"], { nonCredit: true }),
      course(3, ["F"], { excluded: true }),
      course(3, ["B"]),
    ];
    expect(cgpa(list)).toBeCloseTo(3.0);
    expect(gradedCredits(list)).toBe(3);
    expect(earnedCredits(list)).toBe(3);
  });

  it("counts a course's credits once however many times it was taken", () => {
    const retaken = course(3, ["F", "D", "C", "B"]);
    expect(earnedCredits([retaken])).toBe(3);
    expect(gradedCredits([retaken])).toBe(3);
  });
});

describe("canRetake", () => {
  it("allows a first attempt", () => {
    expect(canRetake([])).toBe(true);
  });

  it("is blocked at B+ and above", () => {
    for (const grade of ["B+", "A-", "A"]) expect(canRetake(grades(grade))).toBe(false);
    expect(canRetake(grades("C", "F", "A-"))).toBe(false);
  });

  it("is allowed below B+, with no limit on attempts", () => {
    for (const grade of ["B", "B-", "C+", "C", "C-", "D+", "D", "F"]) {
      expect(canRetake(grades(grade))).toBe(true);
    }
    expect(canRetake(grades(...Array.from({ length: 12 }, () => "F")))).toBe(true);
  });

  it("is never blocked by I, W or a waiver", () => {
    expect(canRetake(grades("I", "W", WAIVED))).toBe(true);
    expect(canRetake(grades("W", "C", "I"))).toBe(true);
    expect(canRetake(grades(WAIVED))).toBe(true);
  });

  it("takes its cutoff from the policy, not from the code", () => {
    const strict: RetakePolicy = { name: "below-b", blockedFrom: "B" };
    expect(canRetake(grades("B"), strict)).toBe(false);
    expect(canRetake(grades("B-"), strict)).toBe(true);
  });
});
