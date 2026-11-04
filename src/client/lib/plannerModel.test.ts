import { describe, expect, it } from "vite-plus/test";
import { buildCgpaSummary } from "../../server/features/attempts/summary";
import { cgpa, gradedCredits } from "../../shared/grading";
import { adviseRetakes, applyMocks, projectedCgpa } from "../../shared/planner";
import type { CourseMap } from "../../shared/schemas/courses";
import {
  buildPlannerModel,
  historyLine,
  mockChangesNothing,
  mocksForRows,
  targetReached,
} from "./plannerModel";

type Slot = CourseMap["categories"][number]["slots"][number];

const slot = (over: Partial<Slot> & Pick<Slot, "code">): Slot => ({
  kind: "course",
  title: `Title ${over.code}`,
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

const map = (slots: Slot[]): CourseMap => ({
  curriculum: {
    id: 1,
    programCode: "CSE",
    programName: "CSE",
    name: "CSE",
    version: "2022",
    effectiveFromYear: 2022,
  },
  degree: { required: 30, earned: 6 },
  categories: [{ name: "Core", required: 15, earned: 6, trails: null, slots }],
  extras: [],
});

const attempt = (courseCode: string, grade: string) => ({ courseCode, grade });

// B- (retakable), A (not retakable), F-only, an open elective, a non-credit course and a waived one.
const sample = map([
  slot({ code: "CSE101", status: "done", filledBy: "CSE101", chosenCode: "CSE101" }),
  slot({ code: "CSE102", status: "done", filledBy: "CSE102", chosenCode: "CSE102" }),
  slot({ code: "CSE103", chosenCode: "CSE103" }),
  slot({ kind: "elective", code: "ELEC", title: "", credits: 4 }),
  slot({ code: "INT100", nonCredit: true }),
  slot({ code: "ENG100", status: "done", filledBy: "ENG100", waived: true }),
  slot({ code: "CSE104" }),
]);
const attempts = [
  attempt("CSE101", "B-"),
  attempt("CSE102", "A"),
  attempt("CSE103", "F"),
  attempt("ENG100", "WV"),
];

describe("buildPlannerModel", () => {
  const model = buildPlannerModel(sample, attempts);

  it("offers a retake mock only on a graded course that can still be retaken", () => {
    expect(model.retakes.map((r) => r.key)).toEqual(["CSE101"]);
    expect(model.retakes[0]).toMatchObject({ kind: "retake", best: "B-", credits: 3 });
    expect(model.lockedCount).toBe(1);
  });

  it("lists the worst retake first", () => {
    const done = (code: string) => slot({ code, status: "done", filledBy: code, chosenCode: code });
    const { retakes } = buildPlannerModel(map([done("CSE101"), done("CSE102"), done("CSE103")]), [
      attempt("CSE101", "B-"),
      attempt("CSE102", "D"),
      attempt("CSE103", "C"),
    ]);
    expect(retakes.map((r) => r.key)).toEqual(["CSE102", "CSE103", "CSE101"]);
  });

  it("lists unfinished credit-bearing slots as first-attempt rows, F-only and open electives included", () => {
    expect(model.future.map((r) => r.key)).toEqual(["CSE103", "slot:Core:3", "slot:Core:6"]);
    expect(model.future.find((r) => r.key === "CSE103")?.best).toBe("F");
    expect(model.future.find((r) => r.key === "slot:Core:3")).toMatchObject({ credits: 4 });
    // Non-credit and waived slots never appear.
    expect(model.future.some((r) => r.code === "INT100")).toBe(false);
    expect(model.retakes.some((r) => r.code === "ENG100")).toBe(false);
  });

  it("builds the same records the server's CGPA summary uses", () => {
    expect(cgpa(model.records)).toBe(buildCgpaSummary(sample, attempts as never).cgpa);
    // Each record is filed under its course map category, which the advisor predicts grades by.
    expect(model.records.find((r) => r.code === "CSE101")?.category).toBe("Core");
    expect(model.remaining.find((r) => r.code === "CSE103")?.category).toBe("Core");
  });

  it("feeds the advisor: passing the F-only course replaces the F without growing graded credits", () => {
    const rows = [...model.future, ...model.retakes];
    const mocks = mocksForRows(rows, { CSE103: "B" });
    const before = cgpa(model.records) ?? 0;
    const after = projectedCgpa(model.records, mocks) ?? 0;
    expect(after).toBeGreaterThan(before);
    // The F already counted as a graded course, so passing it grows no graded credits.
    expect(gradedCredits(applyMocks(model.records, mocks))).toBe(gradedCredits(model.records));
    // And a slot with a mock leaves the credits the advisor still plans for.
    const advice = adviseRetakes(model.records, mocks, model.remaining, 3.25);
    if (advice.kind === "reached") throw new Error("unexpected advice reached");
    expect(advice.remainingCredits).toBe(model.remaining.reduce((n, r) => n + r.credits, 0) - 3);
  });

  it("drops picks for rows that no longer exist", () => {
    const rows = [...model.future, ...model.retakes];
    expect(mocksForRows(rows, { GONE999: "A", CSE101: "A" })).toEqual([
      { code: "CSE101", credits: 3, grade: "A" },
    ]);
  });
});

describe("shared course codes", () => {
  const either = [{ code: "CSE200", title: "Either" }];
  const same = (over: Partial<Slot> = {}) =>
    slot({ code: "CSE200", chosenCode: "CSE200", ...over });
  const keysOf = (m: ReturnType<typeof buildPlannerModel>) =>
    [...m.future, ...m.retakes].map((r) => r.key);

  it("keys a code once: later unfinished slots that chose it use their own keys", () => {
    // Enough graded courses for a prediction, which is what used to go past 4.0.
    const history = ["CSE301", "CSE302", "CSE303", "CSE304", "CSE305", "CSE306", "CSE307"];
    const shared = buildPlannerModel(
      map([
        same({ code: "CSE201", alternatives: either }),
        same({ code: "CSE202", alternatives: either }),
        same({ code: "CSE203", alternatives: either }),
        slot({ code: "CSE204" }),
        ...history.map((code) => slot({ code, status: "done", filledBy: code, chosenCode: code })),
      ]),
      [attempt("CSE200", "F"), ...history.map((code) => attempt(code, "A"))],
    );
    expect(shared.future.map((r) => r.key)).toEqual([
      "CSE200",
      "slot:Core:1",
      "slot:Core:2",
      "slot:Core:3",
    ]);
    expect(new Set(shared.remaining.map((r) => r.code)).size).toBe(4);

    // Before the fix all three slots keyed CSE200: the advisor added grade points for each but
    // credited the F once, so the finish went past 4.0.
    const advice = adviseRetakes(shared.records, [], shared.remaining, 3.9);
    if (!("predictedCgpa" in advice)) throw new Error(`got ${advice.kind}`);
    expect(advice.predictedCgpa).toBeLessThanOrEqual(4);
    // Only the one slot that holds the F's record is graded; the others add new credits.
    expect(advice.remainingCredits).toBe(12);
  });

  it("a mock on the shared code clears one slot, not all of them", () => {
    const shared = buildPlannerModel(
      map([
        same({ code: "CSE201", alternatives: either }),
        same({ code: "CSE202", alternatives: either }),
      ]),
      [attempt("CSE200", "F")],
    );
    const mocks = mocksForRows(shared.future, { CSE200: "B" });
    expect(mocks).toHaveLength(1);
    const advice = adviseRetakes(shared.records, mocks, shared.remaining, 3.9);
    if (advice.kind === "reached") throw new Error("unexpected reached");
    expect(advice.remainingCredits).toBe(3);
  });

  it("a code a finished slot used never keys a future row, in either slot order", () => {
    const done = same({
      code: "CSE201",
      alternatives: either,
      status: "done",
      filledBy: "CSE200",
    });
    const open = same({ code: "CSE202", alternatives: either });
    for (const slots of [
      [done, open],
      [open, done],
    ]) {
      const m = buildPlannerModel(map(slots), [attempt("CSE200", "B-")]);
      expect(m.retakes.map((r) => r.key)).toEqual(["CSE200"]);
      expect(m.future.map((r) => r.key)).toEqual([expect.stringMatching(/^slot:Core:\d$/)]);
      expect(new Set(keysOf(m)).size).toBe(2);
    }
  });

  it("an elective filler already used by another slot gets its own key", () => {
    const filler = { code: "EEE100", title: "Circuits", credits: 3 } as Slot["studentCourse"];
    const elective = (code: string) =>
      slot({ kind: "elective", code, studentCourse: filler, status: "available" });
    const m = buildPlannerModel(map([elective("ELEC1"), elective("ELEC2")]), []);
    expect(m.future.map((r) => r.key)).toEqual(["EEE100", "slot:Core:1"]);
  });
});

describe("courses in the CGPA with no slot row", () => {
  const extra = (code: string, over: Partial<CourseMap["extras"][number]> = {}) => ({
    id: 1,
    code,
    title: `Extra ${code}`,
    credits: 3,
    category: "Open Elective",
    excluded: false,
    createdAt: 0,
    done: false,
    waived: false,
    ...over,
  });
  const withExtras = (slots: Slot[], extras: CourseMap["extras"]): CourseMap => ({
    ...map(slots),
    extras,
  });

  it("an F on an extra course becomes a retake row, open and not marked done", () => {
    const m = buildPlannerModel(withExtras([], [extra("BUS101")]), [attempt("BUS101", "F")]);
    expect(m.retakes).toEqual([
      expect.objectContaining({
        key: "BUS101",
        title: "Extra BUS101",
        category: "Open Elective",
        best: "F",
        status: "available",
      }),
    ]);
  });

  it("an F left on an alternative after another was passed becomes a retake row", () => {
    const m = buildPlannerModel(
      map([
        slot({
          code: "ENG115",
          alternatives: [{ code: "BEN205", title: "Bangla" }],
          status: "done",
          filledBy: "ENG115",
          chosenCode: "ENG115",
        }),
      ]),
      [attempt("ENG115", "A"), attempt("BEN205", "F")],
    );
    expect(m.retakes).toEqual([
      expect.objectContaining({ key: "BEN205", title: "Bangla", category: "Core", best: "F" }),
    ]);
    expect(m.lockedCount).toBe(1);
  });

  it("the advisor suggests retaking the failed extra, so a reachable target is not out of reach", () => {
    // Eight B+ slots (not retakable) and an F on an extra: 2.93 now, 3.1 is only reachable by retaking the F.
    const done = (code: string) => slot({ code, status: "done", filledBy: code, chosenCode: code });
    const codes = ["CSE111", "CSE112", "CSE113", "CSE114", "CSE115", "CSE116", "CSE117", "CSE118"];
    const m = buildPlannerModel(withExtras(codes.map(done), [extra("BUS101")]), [
      ...codes.map((c) => attempt(c, "B+")),
      attempt("BUS101", "F"),
    ]);
    const advice = adviseRetakes(m.records, [], m.remaining, 3.1);
    expect(advice.kind).toBe("retakes_suggested");
    if (advice.kind !== "retakes_suggested") return;
    expect(advice.retakes.map((r) => r.code)).toEqual(["BUS101"]);
  });

  it("keeps a waived extra course out", () => {
    const m = buildPlannerModel(withExtras([], [extra("BUS101", { done: true, waived: true })]), [
      attempt("BUS101", "WV"),
    ]);
    expect(m.retakes).toEqual([]);
    expect(m.lockedCount).toBe(0);
  });

  it("gives a waived alternative no row, even when another alternative filled the slot", () => {
    const m = buildPlannerModel(
      map([
        slot({
          code: "ENG115",
          status: "done",
          filledBy: "ENG115",
          chosenCode: "ENG115",
          alternatives: [{ code: "BEN205", title: "Bangla" }],
        }),
      ]),
      [attempt("ENG115", "C"), attempt("BEN205", "F"), attempt("BEN205", "WV")],
    );
    expect(m.retakes.map((r) => r.key)).toEqual(["ENG115"]);
  });

  it("keeps a course with a real pass and a waiver as a retake, and every row reaches the maximum", () => {
    const done = (code: string) => slot({ code, status: "done", filledBy: code, chosenCode: code });
    const m = buildPlannerModel(map([done("CSE101"), done("CSE102")]), [
      attempt("CSE101", "D"),
      attempt("CSE101", "WV"),
      attempt("CSE102", "C"),
    ]);
    expect(m.retakes.map((r) => r.key)).toEqual(["CSE101", "CSE102"]);
    const advice = adviseRetakes(m.records, [], m.remaining, 4);
    if (advice.kind !== "out_of_reach") throw new Error(`got ${advice.kind}`);
    const allA = mocksForRows(m.retakes, { CSE101: "A", CSE102: "A" });
    expect(advice.maxCgpa).toBeCloseTo(projectedCgpa(m.records, allA) ?? 0);
  });

  it("gives an F then waived extra course no row and no suggestion", () => {
    const m = buildPlannerModel(withExtras([], [extra("BUS101", { done: true, waived: true })]), [
      attempt("BUS101", "F"),
      attempt("BUS101", "WV"),
    ]);
    expect(m.retakes).toEqual([]);
    const advice = adviseRetakes(m.records, [], m.remaining, 4);
    const codes = "retakes" in advice ? advice.retakes.map((r) => r.code) : [];
    expect(codes).not.toContain("BUS101");
  });
});

describe("mockChangesNothing", () => {
  const row = buildPlannerModel(sample, attempts).retakes[0];
  it("is true for a grade at or below the best, false above it", () => {
    expect(mockChangesNothing(row, "C")).toBe(true);
    expect(mockChangesNothing(row, "B-")).toBe(true);
    expect(mockChangesNothing(row, "B+")).toBe(false);
  });
});

describe("targetReached", () => {
  it("is true at or above the target and false with no CGPA or no target", () => {
    expect(targetReached(3.5, 3.5)).toBe(true);
    expect(targetReached(3.7, 3.5)).toBe(true);
    expect(targetReached(3.49, 3.5)).toBe(false);
    expect(targetReached(null, 3.5)).toBe(false);
    expect(targetReached(3.5, null)).toBe(false);
  });
});

describe("historyLine", () => {
  const ceiling = (source: "history" | "fallback", gradedCourses: number) => ({
    grade: "A",
    points: 4,
    source,
    gradedCourses,
  });
  const outlook = (source: "history" | "fallback", gradedCourses: number) => ({
    overall: 3.25,
    average: gradedCourses === 0 ? null : 3.22,
    byCategory: {},
    source,
    gradedCourses,
  });

  it("says predictions come from the student's own grades by category", () => {
    expect(
      historyLine({
        kind: "no_retakes_needed",
        outlook: outlook("history", 18),
        ceiling: ceiling("history", 18),
      }),
    ).toBe("Predicted from your grades by category (average 3.22).");
  });

  it("says when predictions are rough", () => {
    const kind = "out_of_reach";
    const line = historyLine({
      kind,
      outlook: outlook("fallback", 2),
      ceiling: ceiling("fallback", 2),
    });
    expect(line).toMatch(
      /^Rough until you have \d+ graded courses \(2 so far\)\. Best case assumes A\.$/,
    );
    const none = historyLine({
      kind,
      outlook: outlook("fallback", 0),
      ceiling: ceiling("fallback", 0),
    });
    expect(none).toMatch(/\(none so far\)\. Best case assumes A\.$/);
  });

  it("says when predictions start, with no best case, while it is too early", () => {
    const line = historyLine({
      kind: "too_early",
      outlook: outlook("fallback", 3),
      ceiling: ceiling("fallback", 3),
    });
    expect(line).toMatch(/^Predictions start at \d+ graded courses \(3 so far\)\.$/);
  });
});
