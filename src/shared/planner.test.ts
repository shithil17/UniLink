import { describe, expect, it } from "vite-plus/test";
import { cgpa, gradedCredits } from "./grading";
import {
  PLANNER_FALLBACK_CEILING,
  PLANNER_FALLBACK_AVERAGE,
  PLANNER_PRIOR_COURSES,
  PLANNER_HISTORY_MIN_COURSES,
  PLANNER_MAX_SUGGESTIONS,
  adviseRetakes,
  applyMocks,
  neededAverage,
  projectedCgpa,
  realisticCeiling,
  outlook,
  predictedPoints,
  type PlannerCourse,
} from "./planner";

/** A course of `credits` credits with one attempt per grade. */
const rec = (
  code: string,
  credits: number,
  grades: string[],
  extra: Partial<PlannerCourse> = {},
): PlannerCourse => ({ code, credits, attempts: grades.map((grade) => ({ grade })), ...extra });

const gainOf = (retakes: { gainPerCredit: number; credits: number }[]) =>
  retakes.reduce((sum, r) => sum + r.gainPerCredit * r.credits, 0);

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

// Eight 3-credit courses: A in Core, D in General Education. Average 2.5, ceiling A.
const core = ["A1", "A2", "A3", "A4"].map((code) => rec(code, 3, ["A"], { category: "Core" }));
const genEd = ["D1", "D2", "D3", "D4"].map((code) => rec(code, 3, ["D"], { category: "GenEd" }));
const split = [...core, ...genEd];

describe("outlook", () => {
  it("starts at the fallback average with no history", () => {
    expect(outlook([])).toMatchObject({
      overall: 3.3,
      average: null,
      source: "fallback",
      gradedCourses: 0,
    });
    expect(PLANNER_FALLBACK_AVERAGE).toBe("B+");
  });

  it("predicts by category, pulled toward the overall average while a category is small", () => {
    const k = PLANNER_PRIOR_COURSES;
    const o = outlook(split);
    // Overall: the 2.5 average over 8 courses, pulled toward B+ (3.3) with k courses of weight.
    const overall = (2.5 * 8 + 3.3 * k) / (8 + k);
    expect(o.average).toBeCloseTo(2.5, 10);
    expect(o.overall).toBeCloseTo(overall, 10);
    expect(o.source).toBe("history");
    // Each category: its own mean over 4 courses, pulled toward the overall prediction.
    expect(o.byCategory.Core.predicted).toBeCloseTo((4 * 4 + overall * k) / (4 + k), 10);
    expect(o.byCategory.GenEd.predicted).toBeCloseTo((1 * 4 + overall * k) / (4 + k), 10);
    expect(o.byCategory.Core.predicted).toBeGreaterThan(o.overall);
    expect(o.byCategory.GenEd.predicted).toBeLessThan(o.overall);
  });

  it("uses the overall prediction for a course with no category or a category with no grades", () => {
    const o = outlook(split);
    expect(predictedPoints(o, undefined)).toBe(o.overall);
    expect(predictedPoints(o, "Capstone")).toBe(o.overall);
    expect(predictedPoints(o, "Core")).toBe(o.byCategory.Core.predicted);
  });

  it("leaves I, W, WV, non-credit and excluded courses out", () => {
    const noise = [
      rec("I1", 3, ["I"], { category: "Core" }),
      rec("V1", 3, ["WV"], { category: "Core" }),
      rec("N1", 0, ["F"], { category: "Core", nonCredit: true }),
      rec("X1", 3, ["F"], { category: "Core", excluded: true }),
    ];
    expect(outlook([...split, ...noise])).toEqual(outlook(split));
  });
});

describe("adviseRetakes", () => {
  // Two remaining courses: one in each category. 24 graded credits, 60 grade points.
  const remaining = [
    { code: "R1", credits: 3, category: "Core" },
    { code: "R2", credits: 3, category: "GenEd" },
  ];
  const o = outlook(split);
  const corePts = o.byCategory.Core.predicted;
  const genPts = o.byCategory.GenEd.predicted;
  // At usual grades: (60 + 3 core + 3 genEd) / 30, about 2.52.
  const usual = (60 + 3 * corePts + 3 * genPts) / 30;
  // A D retake in GenEd is predicted at genPts (about 1.74), shown as C- (1.7): 0.7 * 3 points.
  const perRetake = (0.7 * 3) / 30;

  it("is reached when nothing is left and the CGPA is at the target, with or without mocks", () => {
    expect(adviseRetakes(split, [], [], 2.5)).toMatchObject({ kind: "reached", cgpa: 2.5 });
    const mocked = adviseRetakes([rec("CSE111", 3, ["B"])], [mock("F1", "A", 3)], [], 3.5);
    expect(mocked.kind).toBe("reached");
    // Every remaining course mocked also leaves nothing to take.
    const allMocked = adviseRetakes(split, [mock("R1", "A"), mock("R2", "A")], remaining, 2.5);
    expect(allMocked.kind).toBe("reached");
  });

  it("is not reached while courses remain, even with the CGPA at the target", () => {
    // CGPA is 2.5 today, but both remaining courses are General Education, predicted near C-.
    const weak = [
      { code: "R1", credits: 3, category: "GenEd" },
      { code: "R2", credits: 3, category: "GenEd" },
    ];
    const advice = adviseRetakes(split, [], weak, 2.5);
    // Usual grades give (60 + 6 * genPts) / 30, about 2.35: retakes are needed to hold 2.5.
    if (advice.kind !== "retakes_suggested") throw new Error(`got ${advice.kind}`);
    expect(advice.retakes.length).toBeGreaterThan(0);
    expect(advice.predictedCgpa).toBeCloseTo((60 + 6 * genPts + gainOf(advice.retakes)) / 30, 10);
    expect(advice.text).not.toMatch(/guarantee/i);
  });

  it("advises no retakes when the predicted finish meets the target", () => {
    const advice = adviseRetakes(split, [], remaining, 2.51);
    if (advice.kind !== "no_retakes_needed") throw new Error(`got ${advice.kind}`);
    expect(advice.predictedCgpa).toBeCloseTo(usual, 10);
    expect(advice.neededAverage).toBeCloseTo(neededAverage(split, remaining, 2.51) ?? 0, 10);
    expect(advice.predictedAverage).toBeCloseTo((corePts + genPts) / 2, 10);
    expect(advice.remainingCredits).toBe(6);
    expect(advice.text).not.toMatch(/guarantee/i);
  });

  it("does not take a needed average under the best grade as reachable", () => {
    // 2.9 needs about 4.0 in the remaining courses: possible only with straight A's, so the
    // advisor does not call it "no retakes needed" just because the ceiling is an A.
    const advice = adviseRetakes(split, [], remaining, 2.9);
    expect(advice.kind).not.toBe("no_retakes_needed");
  });

  it("adds retakes with the largest predicted gain until the predicted finish meets the target", () => {
    // usual about 2.519, one retake about 2.592, two about 2.666 -> 2.6 needs two.
    expect(usual + perRetake).toBeLessThan(2.6);
    expect(usual + 2 * perRetake).toBeGreaterThan(2.6);
    const advice = adviseRetakes(split, [], remaining, 2.6);
    if (advice.kind !== "retakes_suggested") throw new Error(`got ${advice.kind}`);
    expect(advice.text).toBe("Retaking 2 courses gets you there.");
    expect(advice.retakes.map((r) => r.code)).toEqual(["D1", "D2"]);
    // The retake is predicted from the student's GenEd grades (about 1.74, nearest C-), not an A.
    expect(advice.retakes[0]).toMatchObject({ currentBest: "D", aimFor: "C-", credits: 3 });
    expect(advice.retakes[0].gainPerCredit).toBeCloseTo(0.7, 10);
    expect(advice.predictedCgpa).toBeCloseTo(usual + 2 * perRetake, 10);
  });

  it("never suggests a remaining F-only course, a course that can't be retaken, or a mocked one", () => {
    const failed = rec("F1", 3, ["F"], { category: "GenEd" });
    const advice = adviseRetakes(
      [...split, failed],
      [mock("D1", "C")],
      [...remaining, { code: "F1", credits: 3, category: "GenEd" }],
      3.9,
    );
    if (advice.kind !== "out_of_reach") throw new Error(`got ${advice.kind}`);
    const codes = advice.retakes.map((r) => r.code);
    expect(codes).not.toContain("F1");
    expect(codes).not.toContain("D1");
    expect(codes.some((c) => c.startsWith("A"))).toBe(false);
  });

  it("breaks gain ties by more credits, then by course code", () => {
    const records = [
      rec("X3", 3, ["D"], { category: "G" }),
      rec("X2", 3, ["D"], { category: "G" }),
      rec("X4", 4, ["D"], { category: "G" }),
    ];
    const advice = adviseRetakes(records, [], [], 3.9);
    if (advice.kind !== "out_of_reach") throw new Error(`got ${advice.kind}`);
    expect(advice.retakes.map((r) => r.code)).toEqual(["X4", "X2", "X3"]);
  });

  it("mocked remaining courses leave the remaining credits", () => {
    const advice = adviseRetakes(split, [mock("R1", "A", 3)], remaining, 2.7);
    if (advice.kind === "reached") throw new Error("not reached");
    expect(advice.remainingCredits).toBe(3);
  });

  it("calls a target a stretch when only grades well above the usual reach it", () => {
    // Every GenEd retake at the grade it shows (C-) gives about 2.80; A everywhere would give 4.0.
    const advice = adviseRetakes(split, [], remaining, 2.9);
    if (advice.kind !== "out_of_reach") throw new Error(`got ${advice.kind}`);
    expect(advice.tooManyRetakes).toBe(false);
    expect(advice.retakes.map((r) => r.code)).toEqual(["D1", "D2", "D3", "D4"]);
    expect(advice.predictedCgpa).toBeCloseTo(usual + 4 * perRetake, 10);
    expect(advice.bestCaseCgpa).toBeCloseTo(4, 10);
    expect(advice.maxCgpa).toBeCloseTo(4, 10);
    expect(advice.possible).toBe(true);
    expect(advice.text).toContain("stretch");
  });

  it("calls a target a stretch, not out of reach, when only top grades reach it", () => {
    // Two C courses, thin history: the ceiling case is A- in both (3.7), but A A would give 4.0.
    const records = [rec("CSE118", 3, ["C"]), rec("CSE119", 3, ["C"])];
    const advice = adviseRetakes(records, [], [], 3.8);
    if (advice.kind !== "out_of_reach") throw new Error(`got ${advice.kind}`);
    expect(advice.bestCaseCgpa).toBeCloseTo(3.7, 10);
    expect(advice.maxCgpa).toBeCloseTo(4, 10);
    expect(advice.possible).toBe(true);
    expect(advice.text).toContain("stretch");
  });

  it("never puts the best case below the prediction: a strong category keeps its strength", () => {
    // Three A's in Core and nine B+ elsewhere make the ceiling B+ (3.3), yet Core is predicted near
    // 3.7. With 60 Core credits left, a flat B+ best case would read well below the prediction.
    const history = [
      ...Array.from({ length: 3 }, (_, i) => rec(`A${i}`, 3, ["A"], { category: "Core" })),
      ...Array.from({ length: 9 }, (_, i) => rec(`B${i}`, 3, ["B+"], { category: "Other" })),
    ];
    const left = Array.from({ length: 20 }, (_, i) => ({
      code: `R${i}`,
      credits: 3,
      category: "Core",
    }));
    expect(realisticCeiling(history).points).toBeCloseTo(3.3, 10);
    const advice = adviseRetakes(history, [], left, 4);
    if (advice.kind !== "out_of_reach") throw new Error(`got ${advice.kind}`);
    expect(advice.predictedCgpa).not.toBeNull();
    expect(advice.predictedCgpa ?? 0).toBeGreaterThan(3.55);
    expect(advice.bestCaseCgpa ?? 0).toBeGreaterThanOrEqual(advice.predictedCgpa ?? 99);
    expect(advice.maxCgpa ?? 0).toBeGreaterThanOrEqual(advice.bestCaseCgpa ?? 99);
  });

  it("does not suggest retaking a course that has a waived attempt", () => {
    // An F then a WV: the best attempt is the F, but the course is waived and has no planner row.
    const records = [
      rec("A1", 3, ["A"]),
      rec("A2", 3, ["A"]),
      rec("A3", 3, ["A"]),
      rec("W1", 3, ["F", "WV"], { category: "Extra" }),
    ];
    const advice = adviseRetakes(records, [], [], 3.9);
    const codes = advice.kind === "out_of_reach" ? advice.retakes.map((r) => r.code) : [];
    expect(codes).not.toContain("W1");
    expect(advice.kind).toBe("out_of_reach");
    // The same F on a course with no waiver is the retake (guards the test above).
    const unwaived = [...records.slice(0, 3), rec("W1", 3, ["F"], { category: "Extra" })];
    const other = adviseRetakes(unwaived, [], [], 3.9);
    if (other.kind !== "out_of_reach") throw new Error(`got ${other.kind}`);
    expect(other.retakes.map((r) => r.code)).toContain("W1");
  });

  it("calls a target out of reach when even straight A's fall short", () => {
    // Four B+ courses can't be retaken (3.3 each); one 3-credit course remains. Best: 51.6 / 15.
    const records = Array.from({ length: 4 }, (_, i) => rec(`B${i}`, 3, ["B+"]));
    const advice = adviseRetakes(records, [], [{ code: "R1", credits: 3 }], 3.9);
    if (advice.kind !== "out_of_reach") throw new Error(`got ${advice.kind}`);
    expect(advice.maxCgpa).toBeCloseTo((4 * 3 * 3.3 + 3 * 4) / 15, 10);
    expect(advice.possible).toBe(false);
    expect(advice.tooManyRetakes).toBe(false);
    expect(advice.text).toBe("Out of reach by graduation.");
  });

  it("finds a working set of retakes when greedy by gain per credit fills the slots with labs", () => {
    // Ten A's lift the prediction to about 3.13. Five 1-credit D labs gain the most per credit but
    // only about 10.6 points in all; five 3-credit C courses gain about 16.9.
    const history = Array.from({ length: 10 }, (_, i) => rec(`A${i}`, 3, ["A"]));
    const labs = Array.from({ length: 5 }, (_, i) => rec(`LAB${i}`, 1, ["D"]));
    const courses = Array.from({ length: 5 }, (_, i) => rec(`CSE${i}`, 3, ["C"]));
    const records = [...history, ...labs, ...courses];
    const base = cgpa(records) ?? 0; // 155 points over 50 credits
    const five = adviseRetakes(records, [], [], base + 14 / 50);
    if (five.kind !== "retakes_suggested") throw new Error(`got ${five.kind}`);
    expect(five.retakes.map((r) => r.code)).toEqual(courses.map((c) => c.code));
    // 11 points are enough with four courses, and four is the smallest working size.
    const four = adviseRetakes(records, [], [], base + 11 / 50);
    if (four.kind !== "retakes_suggested") throw new Error(`got ${four.kind}`);
    expect(four.retakes.map((r) => r.code)).toEqual(["CSE0", "CSE1", "CSE2", "CSE3"]);
    expect(four.predictedCgpa).toBeGreaterThanOrEqual(base + 11 / 50 - 1e-9);
  });

  it("predicts a remaining F-only course no lower than the lowest passing grade", () => {
    // Eight F's in one category predict that category far below a D (1.0); the course must be passed.
    const failed = Array.from({ length: 8 }, (_, i) => rec(`F${i}`, 3, ["F"], { category: "X" }));
    expect(outlook(failed).byCategory.X.predicted).toBeLessThan(1);
    const advice = adviseRetakes(failed, [], [{ code: "F0", credits: 3, category: "X" }], 4);
    expect(advice.predictedAverage).toBeCloseTo(1, 10);
    // 24 graded credits at 0.0, F0 passed at D: 3 points over 24 credits.
    if (advice.kind === "reached") throw new Error("not reached");
    expect(advice.predictedCgpa).toBeCloseTo(3 / 24, 10);
  });

  it("refuses to list more retakes than the cap", () => {
    // Six C courses, nothing remaining: each retake is predicted at the overall prediction.
    const many = Array.from({ length: PLANNER_MAX_SUGGESTIONS + 1 }, (_, i) =>
      rec(`CSE12${i}`, 3, ["C"]),
    );
    // The prediction is about 2.43, shown as C+ (2.3): each retake adds 0.9 points over 18 credits,
    // so only all six together reach 2.3.
    expect(outlook(many).overall).toBeGreaterThan(2.3);
    const advice = adviseRetakes(many, [], [], 2.3 - 1e-6);
    if (advice.kind !== "out_of_reach") throw new Error(`got ${advice.kind}`);
    expect(advice.tooManyRetakes).toBe(true);
    expect(advice.retakes).toHaveLength(PLANNER_MAX_SUGGESTIONS);
  });

  it("suggests retaking a failed course that is not among the remaining ones", () => {
    // Three A's and an F on an extra course: 36 points over 12 credits. The F predicts to about C+.
    const records = [
      rec("A1", 3, ["A"]),
      rec("A2", 3, ["A"]),
      rec("A3", 3, ["A"]),
      rec("EX1", 3, ["F"], { category: "Extra" }),
    ];
    expect(cgpa(records)).toBe(3);
    const advice = adviseRetakes(records, [], [], 3.5);
    if (advice.kind !== "retakes_suggested") throw new Error(`got ${advice.kind}`);
    expect(advice.retakes).toEqual([
      expect.objectContaining({ code: "EX1", currentBest: "F", aimFor: "C+", gainPerCredit: 2.3 }),
    ]);

    // Top grades on the F reach 3.9, so it is a stretch, not out of reach.
    const stretch = adviseRetakes(records, [], [], 3.9);
    if (stretch.kind !== "out_of_reach") throw new Error(`got ${stretch.kind}`);
    expect(stretch.maxCgpa).toBeCloseTo(4, 10);
    expect(stretch.possible).toBe(true);
  });

  it("does not suggest a retake whose shown grade is the one the student already has", () => {
    // Four B's predict to about 3.13, which reads as B: a B -> B retake gains nothing the student sees.
    const records = Array.from({ length: 4 }, (_, i) => rec(`B${i}`, 3, ["B"]));
    expect(outlook(records).overall).toBeGreaterThan(3);
    const advice = adviseRetakes(records, [], [], 3.1);
    if (advice.kind !== "out_of_reach") throw new Error(`got ${advice.kind}`);
    expect(advice.retakes).toEqual([]);
    expect(advice.text).not.toContain("gets you there");
  });

  it("only suggests retakes that show a better grade", () => {
    const records = [
      ...Array.from({ length: 4 }, (_, i) => rec(`B${i}`, 3, ["B"])),
      rec("D1", 3, ["D"]),
    ];
    const advice = adviseRetakes(records, [], [], 3.9);
    if (advice.kind !== "out_of_reach") throw new Error(`got ${advice.kind}`);
    expect(advice.retakes.map((r) => r.code)).toEqual(["D1"]);
    for (const r of advice.retakes) {
      expect(r.gainPerCredit).toBeGreaterThan(0);
      expect(r.aimFor).not.toBe(r.currentBest);
    }
  });
});
