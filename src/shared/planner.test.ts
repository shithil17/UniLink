import { describe, expect, it } from "vite-plus/test";
import { cgpa, gradedCredits } from "./grading";
import {
  PLANNER_FALLBACK_CEILING,
  PLANNER_FALLBACK_TYPICAL,
  PLANNER_HISTORY_MIN_COURSES,
  PLANNER_MAX_SUGGESTIONS,
  adviseRetakes,
  applyMocks,
  neededAverage,
  projectedCgpa,
  realisticCeiling,
  typicalGrade,
  type PlannerCourse,
} from "./planner";

/** A course of `credits` credits with one attempt per grade. */
const rec = (
  code: string,
  credits: number,
  grades: string[],
  extra: Partial<PlannerCourse> = {},
): PlannerCourse => ({ code, credits, attempts: grades.map((grade) => ({ grade })), ...extra });

const mock = (code: string, grade: string, credits = 3) => ({ code, credits, grade });

describe("projectedCgpa", () => {
  const records = [rec("CSE111", 3, ["B"]), rec("CSE112", 3, ["F", "C"]), rec("CSE113", 4, ["A"])];

  it("equals cgpa() with no mocks", () => {
    expect(projectedCgpa(records, [])).toBe(cgpa(records));
    expect(projectedCgpa([], [])).toBeNull();
  });

  it("a mock below the best grade changes nothing", () => {
    expect(projectedCgpa(records, [mock("CSE111", "C")])).toBe(cgpa(records));
  });

  it("a mock on a course that can't be retaken is ignored", () => {
    // CSE113 has an A, so the retake policy refuses another attempt; CSE111's B is below B+.
    expect(projectedCgpa(records, [mock("CSE113", "F")])).toBe(cgpa(records));
    const blocked = [rec("CSE114", 3, ["B+"])];
    expect(projectedCgpa(blocked, [mock("CSE114", "A")])).toBe(cgpa(blocked));
  });

  it("a mock retake raises the best grade by hand: B -> A- on 3 of 10 credits", () => {
    // (3*3.0 + 3*2.0 + 4*4.0) = 31 over 10 credits = 3.1; CSE111 at A-: 33.1 -> 3.31.
    expect(projectedCgpa(records, [])).toBeCloseTo(3.1, 10);
    expect(projectedCgpa(records, [mock("CSE111", "A-")])).toBeCloseTo(3.31, 10);
  });

  it("a mock on a new course is a first attempt that grows the graded credits", () => {
    const withNew = applyMocks(records, [mock("slot:1", "A", 3)]);
    expect(gradedCredits(withNew)).toBe(13);
    expect(projectedCgpa(records, [mock("slot:1", "A", 3)])).toBeCloseTo((31 + 12) / 13, 10);
  });

  it("an F-only course passed later replaces the F without growing graded credits", () => {
    const fOnly = [rec("CSE101", 3, ["F"]), rec("CSE102", 3, ["A"])];
    expect(gradedCredits(fOnly)).toBe(6);
    expect(cgpa(fOnly)).toBe(2);
    const passed = applyMocks(fOnly, [mock("CSE101", "B")]);
    expect(gradedCredits(passed)).toBe(6);
    expect(cgpa(passed)).toBe(3.5);
  });

  it("ignores grades without points and mocks with no credits", () => {
    expect(projectedCgpa(records, [mock("CSE111", "W"), mock("x", "A", 0), mock("y", "WV")])).toBe(
      cgpa(records),
    );
  });
});

describe("realisticCeiling", () => {
  it("is the upper quartile of best grades, snapped down", () => {
    // Points sorted: 0 2 3 3 3.3 3.7 4 4 -> 75th percentile at index 5.25 = 3.775 -> A- (3.7).
    const records = [
      rec("C1", 3, ["F", "C"]),
      rec("C2", 3, ["B"]),
      rec("C3", 3, ["B"]),
      rec("C4", 3, ["B+"]),
      rec("C5", 3, ["A-"]),
      rec("C6", 3, ["A"]),
      rec("C7", 3, ["A"]),
      rec("C8", 3, ["F"]),
    ];
    expect(realisticCeiling(records)).toMatchObject({
      grade: "A-",
      points: 3.7,
      source: "history",
      gradedCourses: 8,
    });
  });

  it("snaps down, never up", () => {
    // Points 2 2 2 2 2 2 3.3 3.3: index 5.25 = 2.325 -> C+ (2.3), not B-.
    const records = [
      ...Array.from({ length: 6 }, (_, i) => rec(`L${i}`, 3, ["C"])),
      rec("H1", 3, ["B+"]),
      rec("H2", 3, ["B+"]),
    ];
    expect(realisticCeiling(records).grade).toBe("C+");
  });

  it("leaves I, W, WV, non-credit and excluded courses out of the history", () => {
    const eight = Array.from({ length: PLANNER_HISTORY_MIN_COURSES }, (_, i) =>
      rec(`G${i}`, 3, ["B"]),
    );
    const noise = [
      rec("I1", 3, ["I"]),
      rec("W1", 3, ["W"]),
      rec("V1", 3, ["WV"]),
      rec("N1", 0, ["A"], { nonCredit: true }),
      rec("X1", 3, ["A"], { excluded: true }),
    ];
    const ceiling = realisticCeiling([...eight, ...noise]);
    expect(ceiling).toMatchObject({ grade: "B", source: "history", gradedCourses: 8 });
  });

  it("uses the fallback below the minimum course count", () => {
    const few = Array.from({ length: PLANNER_HISTORY_MIN_COURSES - 1 }, (_, i) =>
      rec(`F${i}`, 3, ["C"]),
    );
    expect(realisticCeiling(few)).toMatchObject({
      grade: PLANNER_FALLBACK_CEILING,
      source: "fallback",
      gradedCourses: PLANNER_HISTORY_MIN_COURSES - 1,
    });
    expect(realisticCeiling([]).source).toBe("fallback");
  });
});

describe("typicalGrade", () => {
  it("is the median of best grades, snapped down", () => {
    // Points sorted: 0 2 3 3 3.3 3.7 4 4 -> median at index 3.5 = 3.15 -> B (3.0).
    const records = [
      rec("C1", 3, ["F", "C"]),
      rec("C2", 3, ["B"]),
      rec("C3", 3, ["B"]),
      rec("C4", 3, ["B+"]),
      rec("C5", 3, ["A-"]),
      rec("C6", 3, ["A"]),
      rec("C7", 3, ["A"]),
      rec("C8", 3, ["F"]),
    ];
    expect(typicalGrade(records)).toMatchObject({ grade: "B", points: 3, source: "history" });
    // The same history's ceiling is A-: the usual grade sits below the best one.
    expect(realisticCeiling(records).grade).toBe("A-");
  });

  it("uses its own fallback below the minimum course count", () => {
    expect(typicalGrade([rec("C1", 3, ["A"])])).toMatchObject({
      grade: PLANNER_FALLBACK_TYPICAL,
      source: "fallback",
      gradedCourses: 1,
    });
  });
});

describe("neededAverage", () => {
  it("is null with nothing remaining", () => {
    expect(neededAverage([rec("CSE111", 3, ["B"])], [], 3.5)).toBeNull();
  });

  it("counts a fresh remaining course in both points and graded credits", () => {
    // 3 credits at B (9 points). Target 3.3 over 3 + 9 credits: (3.3*12 - 9) / 9 = 3.4.
    const needed = neededAverage(
      [rec("CSE111", 3, ["B"])],
      [
        { code: "A", credits: 3 },
        { code: "B", credits: 3 },
        { code: "C", credits: 3 },
      ],
      3.3,
    );
    expect(needed).toBeCloseTo(3.4, 10);
  });

  it("an F-only remaining course adds points but no graded credits", () => {
    // CSE101 F (0) and CSE102 A (12 points) over 6 credits. Passing CSE101 at 2.0: 18/6 = 3.0.
    const records = [rec("CSE101", 3, ["F"]), rec("CSE102", 3, ["A"])];
    expect(neededAverage(records, [{ code: "CSE101", credits: 3 }], 3)).toBeCloseTo(2, 10);
  });
});

describe("adviseRetakes", () => {
  // Six graded courses (below the history minimum), so the ceiling is the fallback A- (3.7) and the
  // typical grade the fallback B+ (3.3).
  const base = [
    rec("CSE111", 3, ["D"]), // gain 2.7 per credit
    rec("CSE112", 3, ["C"]), // 1.7
    rec("CSE113", 4, ["C"]), // 1.7, more credits than CSE112
    rec("CSE114", 3, ["C-"]), // 2.0
    rec("CSE115", 3, ["A"]), // blocked: best grade is not below B+
    rec("CSE116", 3, ["F"]), // required F-only: a remaining course, gain 3.7 but never a retake
  ];
  // CSE116 (F-only) and three fresh courses: 12 credits, 9 of them new graded credits.
  const remaining = [
    { code: "CSE116", credits: 3 },
    { code: "R1", credits: 3 },
    { code: "R2", credits: 3 },
    { code: "R3", credits: 3 },
  ];

  it("is reached when the CGPA is already at the target, with or without mocks", () => {
    const strong = [rec("CSE111", 3, ["A"]), rec("CSE112", 3, ["B"])];
    const advice = adviseRetakes(strong, [], remaining, 3.5);
    expect(advice).toMatchObject({ kind: "reached", cgpa: 3.5 });
    // 3.5 reached through a mock on a future course.
    const mocked = adviseRetakes([rec("CSE111", 3, ["B"])], [mock("F1", "A", 3)], [], 3.5);
    expect(mocked.kind).toBe("reached");
  });

  it("advises no retakes when the needed average fits under the typical grade", () => {
    // Target 2.6: (2.6*28 - 34.1) / 12 = 3.225 <= 3.3.
    const advice = adviseRetakes(base, [], remaining, 2.6);
    expect(advice.kind).toBe("no_retakes_needed");
    if (advice.kind !== "no_retakes_needed") return;
    expect(advice.neededAverage).toBeCloseTo((2.6 * 28 - 34.1) / 12, 10);
    expect(advice.neededGrade).toBe("B+");
    expect(advice.remainingCredits).toBe(12);
    expect(advice.text).not.toMatch(/guarantee/i);
  });

  it("suggests retakes when the needed average is under the ceiling but above the usual grade", () => {
    // Four A and four D courses: ceiling A (4.0), typical C+ (median 2.5 snapped down to 2.3).
    // Target 2.9 over 9 fresh credits needs (2.9*33 - 60) / 9 = 3.97: possible with straight A's,
    // not at the usual grade, so the D courses are retaken: 2.97 after one, 1.97 after two -> fits.
    const history = [
      ...["A1", "A2", "A3", "A4"].map((code) => rec(code, 3, ["A"])),
      ...["D1", "D2", "D3", "D4"].map((code) => rec(code, 3, ["D"])),
    ];
    const fresh = ["R1", "R2", "R3"].map((code) => ({ code, credits: 3 }));
    const advice = adviseRetakes(history, [], fresh, 2.9);
    expect(advice.typical.grade).toBe("C+");
    expect(advice.ceiling.grade).toBe("A");
    if (advice.kind !== "retakes_suggested")
      throw new Error(`expected retakes, got ${advice.kind}`);
    expect(advice.retakes.map((r) => r.code)).toEqual(["D1", "D2"]);
    expect(advice.retakes[0]).toMatchObject({ currentBest: "D", aimFor: "A" });
    expect(advice.neededAverage).toBeCloseTo((2.9 * 33 - 78) / 9, 10);
  });

  it("picks the largest gain per credit first and stops as soon as the target fits", () => {
    // Target 3.2: needs 4.625 with no retakes, 3.95 after CSE111, 3.45 after CSE114 (still above
    // the usual 3.3), 2.88 after CSE113 -> fits.
    const advice = adviseRetakes(base, [], remaining, 3.2);
    expect(advice.kind).toBe("retakes_suggested");
    if (advice.kind !== "retakes_suggested") return;
    expect(advice.retakes.map((r) => r.code)).toEqual(["CSE111", "CSE114", "CSE113"]);
    expect(advice.retakes[0]).toMatchObject({ currentBest: "D", aimFor: "A-", credits: 3 });
    expect(advice.neededAverage).toBeCloseTo((3.2 * 28 - 55) / 12, 10);
    expect(advice.remainingCredits).toBe(12);
  });

  it("never suggests a required F-only course, an A, or a mocked course as a retake", () => {
    const advice = adviseRetakes(base, [], remaining, 3.2);
    if (advice.kind !== "retakes_suggested") throw new Error("expected retakes");
    const codes = advice.retakes.map((r) => r.code);
    expect(codes).not.toContain("CSE116");
    expect(codes).not.toContain("CSE115");

    // CSE111 already carries a mock: the plan is the student's, so it is not suggested again.
    const mocked = adviseRetakes(base, [mock("CSE111", "C")], remaining, 3.2);
    if (mocked.kind !== "retakes_suggested") throw new Error("expected retakes");
    expect(mocked.retakes.map((r) => r.code)).not.toContain("CSE111");
  });

  it("breaks gain ties by more credits, then by course code", () => {
    // CSE112 (3 credits) and CSE113 (4 credits) both gain 1.7 per credit, so the 4-credit course
    // comes first: target 3.3 -> (13*3.3 - 32.8) / 3 = 3.37 after CSE113, still above the usual
    // 3.3, then 1.67 after CSE112.
    const records = [rec("CSE112", 3, ["C"]), rec("CSE113", 4, ["C"]), rec("CSE117", 3, ["A"])];
    const one = adviseRetakes(records, [], [{ code: "R1", credits: 3 }], 3.3);
    if (one.kind !== "retakes_suggested") throw new Error("expected retakes");
    expect(one.retakes.map((r) => r.code)).toEqual(["CSE113", "CSE112"]);

    // Equal gain and credits: the lower code first. Nothing remaining, so the CGPA itself must fit.
    const tied = [rec("CSE119", 3, ["C"]), rec("CSE118", 3, ["C"])];
    const advice = adviseRetakes(tied, [], [], 2.8);
    if (advice.kind !== "retakes_suggested") throw new Error("expected retakes");
    expect(advice.retakes.map((r) => r.code)).toEqual(["CSE118"]);
    expect(advice.neededAverage).toBeNull();
  });

  it("mocked remaining courses leave the remaining credits", () => {
    // Target 2.4: (2.4*31 - 46.1) / 9 = 3.14 <= 3.3 over the 9 unmocked credits.
    const advice = adviseRetakes(base, [mock("R1", "A", 3)], remaining, 2.4);
    if (advice.kind !== "no_retakes_needed") throw new Error("expected no retakes");
    expect(advice.remainingCredits).toBe(9);
  });

  it("reports the highest reachable CGPA when the target is out of reach", () => {
    // Two C courses, nothing remaining: both retaken at A- gives 3.7.
    const records = [rec("CSE118", 3, ["C"]), rec("CSE119", 3, ["C"])];
    const advice = adviseRetakes(records, [], [], 3.8);
    expect(advice).toMatchObject({ kind: "out_of_reach", tooManyRetakes: false });
    if (advice.kind !== "out_of_reach") return;
    expect(advice.highestCgpa).toBeCloseTo(3.7, 10);
    expect(advice.text).toContain("3.70");
  });

  it("refuses to list more retakes than the cap", () => {
    const many = Array.from({ length: PLANNER_MAX_SUGGESTIONS + 1 }, (_, i) =>
      rec(`CSE12${i}`, 3, ["C"]),
    );
    // Every course retaken at A- reaches 3.7, but that is one more retake than the advisor lists.
    const advice = adviseRetakes(many, [], [], 3.7);
    expect(advice).toMatchObject({ kind: "out_of_reach", tooManyRetakes: true });
  });
});
