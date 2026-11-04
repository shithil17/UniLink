import { describe, expect, it } from "vite-plus/test";
import { buildCgpaSummary } from "../../server/features/attempts/summary";
import { cgpa, gradedCredits } from "../../shared/grading";
import { adviseRetakes, applyMocks, projectedCgpa } from "../../shared/planner";
import type { CourseMap } from "../../shared/schemas/courses";
import { buildPlannerModel, mockChangesNothing, mocksForRows, targetReached } from "./plannerModel";

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
    const advice = adviseRetakes(model.records, mocks, model.remaining, 3.5);
    if (advice.kind !== "no_retakes_needed" && advice.kind !== "retakes_suggested") {
      throw new Error(`unexpected advice ${advice.kind}`);
    }
    expect(advice.remainingCredits).toBe(model.remaining.reduce((n, r) => n + r.credits, 0) - 3);
  });

  it("drops picks for rows that no longer exist", () => {
    const rows = [...model.future, ...model.retakes];
    expect(mocksForRows(rows, { GONE999: "A", CSE101: "A" })).toEqual([
      { code: "CSE101", credits: 3, grade: "A" },
    ]);
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
