import curriculum from "../../../data/curricula/42-cse.json";
import { describe, expect, it } from "vite-plus/test";
import { curriculumImport, type CourseMap } from "../../shared/schemas/courses";
import { LEFT_LABEL_WIDTH, layoutCourseSequence, type SequenceCourse } from "./courseSequence";

function mapFromCurriculum(): CourseMap {
  const parsed = curriculumImport.parse(curriculum);
  const names = [...new Set(parsed.courses.map((course) => course.category))];
  return {
    curriculum: null,
    degree: { required: parsed.totalCredits, earned: 0 },
    categories: names.map((name) => ({
      name,
      required: 0,
      earned: 0,
      trails: null,
      slots: parsed.courses
        .filter((course) => course.category === name)
        .map((course) => ({
          ...course,
          status: "locked" as const,
          filledBy: null,
          chosenCode: null,
          waived: false,
          studentCourse: null,
        })),
    })),
    extras: [],
  };
}

const base = (over: Partial<CourseMap["categories"][number]["slots"][number]> = {}) => ({
  kind: "course" as const,
  code: "CSE101",
  title: "Course",
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 1,
  alternatives: [],
  prereq: null,
  status: "locked" as const,
  filledBy: null,
  chosenCode: null,
  waived: false,
  studentCourse: null,
  ...over,
});

function mapWith(
  slots: CourseMap["categories"][number]["slots"][],
  extras: CourseMap["extras"] = [],
): CourseMap {
  return {
    curriculum: null,
    degree: { required: 0, earned: 0 },
    categories: slots.map((rows, i) => ({
      name: `Category ${i + 1}`,
      required: 0,
      earned: 0,
      trails: null,
      slots: rows,
    })),
    extras,
  };
}

describe("layoutCourseSequence", () => {
  it("sums the CSE course rows to 130 credits, excluding non-credit courses", () => {
    const layout = layoutCourseSequence(mapFromCurriculum());
    expect(layout.rows.reduce((sum, row) => sum + row.credits, 0)).toBe(130);
    expect(layout.rows).toHaveLength(12);
  });

  it("uses a compact grid with at least four columns and puts general education at the right", () => {
    const layout = layoutCourseSequence(mapFromCurriculum(), undefined, 1600);
    const courseNodes = layout.nodes.filter((node) => node.type === "sequenceCourse");
    const busiest = Math.max(
      ...layout.rows.map(
        (row) =>
          courseNodes.filter(
            (node) => node.position.y >= row.y && node.position.y < row.y + row.height,
          ).length,
      ),
    );
    expect(layout.columns).toBeGreaterThanOrEqual(4);
    expect(layout.columns).toBe(busiest);
    const geCourses = courseNodes.filter((node) =>
      /general education|\bGED\b/i.test((node.data as SequenceCourse).category),
    );
    expect(geCourses.length).toBeGreaterThan(0);
    expect(
      geCourses.every(
        (node) =>
          Math.floor(
            (node.position.x - LEFT_LABEL_WIDTH + (node.width ?? 0) / 2) / layout.columnWidth,
          ) ===
          layout.columns - 1,
      ),
    ).toBe(true);
  });

  it("keeps the MAT prerequisite chain in one column", () => {
    const layout = layoutCourseSequence(mapFromCurriculum(), undefined, 1600);
    const columns = ["MAT116", "MAT120", "MAT130", "MAT250", "MAT350"].map((code) => {
      const node = layout.nodes.find((item) => item.id === code)!;
      return Math.floor(
        (node.position.x - LEFT_LABEL_WIDTH + (node.width ?? 0) / 2) / layout.columnWidth,
      );
    });
    expect(new Set(columns).size).toBe(1);
  });

  it("merges same-semester labs and splits the merged node on request", () => {
    const map = mapWith([[base(), base({ code: "CSE101L", title: "Course Lab", credits: 1 })]]);
    const merged = layoutCourseSequence(map);
    expect(merged.nodes.filter((node) => node.type === "sequenceCourse")).toHaveLength(1);
    expect(
      (merged.nodes.find((node) => node.type === "sequenceCourse")!.data as { code: string }).code,
    ).toBe("CSE101 + L");
    const split = layoutCourseSequence(map, "CSE101");
    expect(
      split.nodes.filter((node) => node.type === "sequenceCourse").map((node) => node.id),
    ).toEqual(["CSE101", "CSE101L"]);
    expect(split.rows[0]?.credits).toBe(4);
  });

  it("keeps nested any edges dashed, other prerequisites solid and credits as a note", () => {
    const map = mapWith([
      [
        base(),
        base({
          code: "CSE102",
          semester: 2,
          prereq: {
            all: [
              { course: "CSE101" },
              { any: [{ course: "MAT101" }, { course: "PHY101" }] },
              { credits: 30 },
            ],
          },
        }),
        base({ code: "MAT101", category: "Math", semester: 1 }),
        base({ code: "PHY101", category: "Math", semester: 1 }),
      ],
      [],
    ]);
    const layout = layoutCourseSequence(map);
    expect(
      layout.edges.filter((edge) => edge.target === "CSE102").map((edge) => edge.data.dashed),
    ).toEqual([false, true, true]);
    expect(
      (layout.nodes.find((node) => node.id === "CSE102")!.data as { note?: string }).note,
    ).toBe("after 30 credits");
    expect(layout.creditNotes).toEqual([{ code: "CSE102", credits: 30 }]);
  });

  it("points alternatives to their containing slot, preserves curriculum order and includes null rows", () => {
    const map = mapWith([
      [
        base({ code: "CSE201", semester: null, prereq: { course: "ALT101" } }),
        base({ code: "CSE200", semester: null }),
        base({ code: "CSE202", semester: null }),
        base({
          code: "BASE101",
          semester: 1,
          alternatives: [{ code: "ALT101", title: "Alternate" }],
        }),
      ],
    ]);
    const layout = layoutCourseSequence(map);
    expect(layoutCourseSequence(map).nodes.map((node) => [node.id, node.position])).toEqual(
      layout.nodes.map((node) => [node.id, node.position]),
    );
    expect(layout.edges.some((edge) => edge.source === "BASE101" && edge.target === "CSE201")).toBe(
      true,
    );
    expect(layout.rows.map((row) => row.label)).toEqual(["1st", "Unscheduled"]);
    const unscheduled = layout.nodes.filter(
      (node) => node.type === "sequenceCourse" && node.position.y === layout.rows[1]?.y + 10,
    );
    expect(unscheduled.map((node) => node.id)).toEqual(["CSE201", "CSE200", "CSE202"]);
  });
});
